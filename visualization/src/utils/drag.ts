/* eslint-disable @typescript-eslint/no-explicit-any */
import * as d3 from "d3";
import versor from "versor";

interface SimpleDragProps {
    projection: d3.GeoProjection;
    pathGenerator: d3.GeoPath<any, d3.GeoPermissibleObjects>;
    mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
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
}: SimpleDragProps) {
    // Capture the projection's original scale, before any zooming.
    const scale =
        (projection as any)._scale === undefined
            ? ((projection as any)._scale = projection.scale())
            : (projection as any)._scale;
    console.log("Original projection scale:", scale);

    let v0: [number, number, number];
    let q0: [number, number, number, number];
    let r0: [number, number, number];
    let tl = 0;

    const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 10].map((x) => x * scale) as [number, number])
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

        projection.rotate(versor.rotation(q1));

        mapLayer.selectAll(".country").attr("d", pathGenerator as any);
        mapLayer.selectAll(".data-point").each(function (d: any) {
            const center = getMapCenter(projection);
            console.log(
                `Map center: lat=${center.lat.toFixed(2)}, lon=${center.lon.toFixed(2)}`,
            );

            const p = projection([d.lon, d.lat]);
            d3.select(this)
                .attr("cx", p ? p[0] : null)
                .attr("cy", p ? p[1] : null)
                .attr("opacity", isVisible(center, [d.lon, d.lat]) ? "1" : "0");
        });

        // In vicinity of the antipode (unstable) of q0, restart.
        if (delta[0] < 0.7) zoomstarted.call(this, event);
    }

    return (
        selection: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    ) => {
        selection
            .property("__zoom", d3.zoomIdentity.scale(projection.scale()))
            .call(zoom);
        return selection;
    };
}
