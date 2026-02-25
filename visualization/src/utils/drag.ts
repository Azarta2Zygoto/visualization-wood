/* eslint-disable @typescript-eslint/no-explicit-any */
import * as d3 from "d3";
import versor from "versor";

import continent from "@/data/continents.json";
import { config } from "@/metadata/mapConfig";

const ParisCoord: [number, number] = [2.3522, 48.8566];

interface SimpleDragProps {
    projection: d3.GeoProjection;
    pathGenerator: d3.GeoPath<any, d3.GeoPermissibleObjects>;
    mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    projectionScale: number;
    scaleExtent?: [number, number];
    initialTransform?: d3.ZoomTransform;
    initialRotation?: [number, number, number];
    isStatic?: boolean; // If false, need to adapt circle sizes on zoom
    onZoomChange?: (
        zoomScale: number,
        rotation: [number, number, number],
    ) => void;
    correctionSize?: { width: number; height: number }; // Optional correction for centering the globe
}

/**
 * Get the center coordinates (latitude, longitude) of the map based on current projection rotation
 * @param projection - D3 GeoProjection
 * @returns Object with lat (latitude) and lon (longitude) of the map center
 */
export function getMapCenter(projection: d3.GeoProjection): {
    lat: number;
    lon: number;
} {
    const rotation = projection.rotate();

    // projection.rotate([λ, φ, γ]) sets the center to [λ, φ]
    // So the center longitude is -rotation[0] and latitude is -rotation[1]
    return {
        lon: -rotation[0],
        lat: -rotation[1],
    };
}

export function isVisible(
    center: { lat: number; lon: number },
    point: [number, number],
): boolean {
    const { lat, lon } = center;
    const [pointLon, pointLat] = point;
    // Calculate the distance in degrees between the center and the point
    const deltaLon = Math.abs(lon - pointLon);
    const deltaLat = Math.abs(lat - pointLat);
    // Consider a point visible if it's within 90 degrees of the center in both longitude and latitude
    return deltaLon <= 90 && deltaLat <= 90;
}

export function simpleDrag({
    projection,
    pathGenerator,
    mapLayer,
    projectionScale,
    initialTransform = d3.zoomIdentity,
    initialRotation = [0, 0, 0],
    scaleExtent = [0.5, 10],
    isStatic = false,
    onZoomChange,
    correctionSize,
}: SimpleDragProps) {
    // Capture the projection's original scale, before any zooming.
    // Apply initial rotation if provided
    projection.rotate(initialRotation);

    let v0: [number, number, number];
    let q0: [number, number, number, number];
    let r0: [number, number, number];
    let tl = 0;

    const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent(
            scaleExtent.map((x) => x * projectionScale) as [number, number],
        )
        .on("start", zoomstarted)
        .on("zoom", zoomed);

    function point(
        event: any,
        that: SVGSVGElement,
    ): [number, number] | [number, number, number] {
        const t = d3.pointers(event, that);

        if (t.length !== tl) {
            tl = t.length;
            zoomstarted.call(that, event);
        }

        if (tl > 1) {
            return [
                d3.mean(t, (p: any) => p[0]) ?? 0,
                d3.mean(t, (p: any) => p[1]) ?? 0,
                Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]),
            ];
        }

        return t[0];
    }

    function zoomstarted(this: SVGSVGElement, event: any) {
        projection.scale(event.transform.k);
        const pt = point(event, this);
        const coords: [number, number] = [pt[0], pt[1]];
        v0 = versor.cartesian(
            projection.invert ? (projection.invert(coords) ?? [0, 0]) : [0, 0],
        );
        q0 = versor((r0 = projection.rotate()));
    }

    function zoomed(this: SVGSVGElement, event: any) {
        projection.scale(event.transform.k);
        const pt = point(event, this) as [number, number];
        const rotatedProjection = projection.rotate(r0);
        const v1: [number, number, number] = versor.cartesian(
            rotatedProjection.invert
                ? (rotatedProjection.invert(pt) ?? [0, 0])
                : [0, 0],
        );
        const delta = versor.delta(v0, v1);
        const q1 = versor.multiply(q0, delta);

        const newRotation = versor.rotation(q1) as [number, number, number];
        projection.rotate(newRotation);

        // Notify about zoom/rotation changes
        const zoomScale = event.transform.k / projectionScale;
        if (onZoomChange) {
            onZoomChange(zoomScale, newRotation);
        }

        mapLayer.selectAll(".country").attr("d", pathGenerator as any);

        mapLayer.selectAll(".data-point").each(function (d: any) {
            const center = getMapCenter(projection);

            const p = projection([d.lon, d.lat]);
            d3.select(this)
                .attr("cx", p ? p[0] : null)
                .attr("cy", p ? p[1] : null)
                .transition()
                .duration(config.animationDuration)
                .attr("opacity", isVisible(center, [d.lon, d.lat]) ? "1" : "0");
        });

        // Update data-arrow paths (not arrowheads)
        const center = getMapCenter(projection);
        const line = d3
            .line<[number, number]>()
            .curve(d3.curveBasis)
            .defined((p) => !!p);

        mapLayer
            .selectAll<SVGPathElement, any>(".data-arrow:not(.arrow-head)")
            .each(function (d: any) {
                if (!d.continentCode) return;

                const continentInfo =
                    continent[d.continentCode as keyof typeof continent];
                if (!continentInfo) return;

                const continentCenter = continentInfo.center as [
                    number,
                    number,
                ];
                // Center is in [lat, lon] format, convert to [lon, lat] for d3
                const targetGeoCoords: [number, number] = [
                    continentCenter[1],
                    continentCenter[0],
                ];

                // Recompute arc points using geographic interpolation
                // Use fine sampling (0.01 = 100 points) to handle arcs that cross behind the globe
                const interpolate = d3.geoInterpolate(
                    ParisCoord,
                    targetGeoCoords,
                );
                const arcPoints = d3
                    .range(0, 1.001, 0.01)
                    .map((t) => projection(interpolate(t)))
                    .filter((p): p is [number, number] => !!p);

                // Update stored arcPoints for arrowhead use
                d.arcPoints = arcPoints;

                // Check visibility of start and end points
                const startVisible = isVisible(center, ParisCoord);
                const endVisible = isVisible(center, targetGeoCoords);

                d3.select(this)
                    .attr("d", line(arcPoints) || "")
                    .attr("opacity", startVisible || endVisible ? "1" : "0");
            });

        // Get max value from all arrows for sizing
        const allArrowData = mapLayer
            .selectAll<SVGPathElement, any>(".arrow-head")
            .data();
        const maxValue = d3.max(allArrowData, (a) => a.value) || 1;

        mapLayer
            .selectAll(".globe-background")
            .attr("r", projection.scale() * 1.01);
        // Update arrow-head positions
        mapLayer.selectAll<SVGPathElement, any>(".arrow-head").each(function (
            d: any,
        ) {
            if (!d.arcPoints || d.arcPoints.length < 2) {
                d3.select(this).attr("opacity", "0");
                return;
            }

            const end = d.arcPoints[d.arcPoints.length - 1];
            const prev = d.arcPoints[d.arcPoints.length - 2];

            // Calculate angle for arrowhead rotation
            const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);

            // Calculate arrowhead size
            const zoomScale = event.transform.k / projectionScale;
            const baseSize = isStatic ? 17 : 17 * zoomScale;
            const size = 3 + baseSize * (d.value / maxValue) ** 0.5;

            const tipX = end[0];
            const tipY = end[1];

            // Point 1: tip of arrow
            const p1X = tipX + size * Math.cos(angle);
            const p1Y = tipY + size * Math.sin(angle);

            // Point 2: left side of arrow base
            const p2X = end[0] - size * Math.cos(angle - Math.PI / 6);
            const p2Y = end[1] - size * Math.sin(angle - Math.PI / 6);

            // Point 3: right side of arrow base
            const p3X = end[0] - size * Math.cos(angle + Math.PI / 6);
            const p3Y = end[1] - size * Math.sin(angle + Math.PI / 6);

            // Check visibility
            if (!d.continentCode) {
                d3.select(this).attr("opacity", "0");
                return;
            }
            const continentInfo =
                continent[d.continentCode as keyof typeof continent];
            if (!continentInfo) {
                d3.select(this).attr("opacity", "0");
                return;
            }
            const continentCenter = continentInfo.center as [number, number];
            const targetGeoCoords: [number, number] = [
                continentCenter[1],
                continentCenter[0],
            ];
            const endVisible = isVisible(center, targetGeoCoords);

            d3.select(this)
                .attr("d", `M${p1X},${p1Y}L${p2X},${p2Y}L${p3X},${p3Y}Z`)
                .attr("opacity", endVisible ? "1" : "0");
        });

        // In vicinity of the antipode (unstable) of q0, restart.
        if (delta[0] < 0.7) zoomstarted.call(this, event);
    }

    return (
        selection: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    ) => {
        // Use unified zoom scale from initialTransform
        const initialScale = initialTransform.k * projectionScale;
        const zoomScale = initialTransform.k;
        selection
            .property("__zoom", d3.zoomIdentity.scale(initialScale))
            .call(zoom);
        // Redraw the map with the new scale
        projection.scale(initialScale);

        mapLayer
            .insert("circle", ":first-child")
            .attr("class", "globe-background")
            .attr("cx", correctionSize ? correctionSize.width : 0)
            .attr("cy", correctionSize ? correctionSize.height : 0)
            .attr("r", initialScale)
            .attr("fill", "url(#globeGradient)")
            .attr("stroke", "var(--border-color)")
            .attr("stroke-width", 2);

        // Ajoute le <defs> avec le gradient
        const defs = mapLayer.append("defs").attr("id", "globe-gradient-defs");
        const gradient = defs
            .append("linearGradient")
            .attr("id", "globeGradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");

        gradient
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "var(--map-bg-1)");
        gradient
            .append("stop")
            .attr("offset", "25%")
            .attr("stop-color", "var(--map-bg-2)");
        gradient
            .append("stop")
            .attr("offset", "50%")
            .attr("stop-color", "var(--map-bg-3)");
        gradient
            .append("stop")
            .attr("offset", "75%")
            .attr("stop-color", "var(--map-bg-2)");
        gradient
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "var(--map-bg-1)");
        mapLayer.selectAll(".country").attr("d", pathGenerator as any);

        // Initialize data points position
        const center = getMapCenter(projection);
        mapLayer.selectAll(".data-point").each(function (d: any) {
            const p = projection([d.lon, d.lat]);
            const sel = d3.select(this);
            sel.attr("cx", p ? p[0] : null)
                .attr("cy", p ? p[1] : null)
                .attr("opacity", isVisible(center, [d.lon, d.lat]) ? "1" : "0");
        });

        // Initialize arrow paths
        const line = d3
            .line<[number, number]>()
            .curve(d3.curveBasis)
            .defined((p) => !!p);

        mapLayer
            .selectAll<SVGPathElement, any>(".data-arrow:not(.arrow-head)")
            .each(function (d: any) {
                if (!d.continentCode) return;

                const continentInfo =
                    continent[d.continentCode as keyof typeof continent];
                if (!continentInfo) return;

                const continentCenter = continentInfo.center as [
                    number,
                    number,
                ];
                const targetGeoCoords: [number, number] = [
                    continentCenter[1],
                    continentCenter[0],
                ];

                // Use fine sampling (0.01 = 100 points) to handle arcs that cross behind the globe
                const interpolate = d3.geoInterpolate(
                    ParisCoord,
                    targetGeoCoords,
                );
                const arcPoints = d3
                    .range(0, 1.001, 0.01)
                    .map((t) => projection(interpolate(t)))
                    .filter((p): p is [number, number] => !!p);

                d.arcPoints = arcPoints;

                const startVisible = isVisible(center, ParisCoord);
                const endVisible = isVisible(center, targetGeoCoords);

                const sel = d3.select(this);
                sel.attr("d", line(arcPoints) || "").attr(
                    "opacity",
                    startVisible || endVisible ? "1" : "0",
                );
            });

        // Initialize arrowheads
        mapLayer.selectAll<SVGPathElement, any>(".arrow-head").each(function (
            d: any,
        ) {
            if (!d.arcPoints || d.arcPoints.length < 2) {
                d3.select(this).attr("opacity", "0");
                return;
            }

            const end = d.arcPoints[d.arcPoints.length - 1];
            const prev = d.arcPoints[d.arcPoints.length - 2];
            const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);

            const allArrowData = mapLayer
                .selectAll<SVGPathElement, any>(".arrow-head")
                .data();
            const maxValue = d3.max(allArrowData, (a) => a.value) || 1;

            const baseSize = isStatic ? 17 : 17 * zoomScale;
            const size = 3 + baseSize * (d.value / maxValue) ** 0.5;

            const tipX = end[0];
            const tipY = end[1];
            const p1X = tipX + size * Math.cos(angle);
            const p1Y = tipY + size * Math.sin(angle);
            const p2X = end[0] - size * Math.cos(angle - Math.PI / 6);
            const p2Y = end[1] - size * Math.sin(angle - Math.PI / 6);
            const p3X = end[0] - size * Math.cos(angle + Math.PI / 6);
            const p3Y = end[1] - size * Math.sin(angle + Math.PI / 6);

            if (!d.continentCode) {
                d3.select(this).attr("opacity", "0");
                return;
            }
            const continentInfo =
                continent[d.continentCode as keyof typeof continent];
            if (!continentInfo) {
                d3.select(this).attr("opacity", "0");
                return;
            }
            const continentCenter = continentInfo.center as [number, number];
            const targetGeoCoords: [number, number] = [
                continentCenter[1],
                continentCenter[0],
            ];
            const endVisible = isVisible(center, targetGeoCoords);

            d3.select(this)
                .attr("d", `M${p1X},${p1Y}L${p2X},${p2Y}L${p3X},${p3Y}Z`)
                .attr("opacity", endVisible ? "1" : "0");
        });

        return selection;
    };
}
