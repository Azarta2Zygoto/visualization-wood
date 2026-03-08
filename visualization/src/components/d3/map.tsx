/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useTranslations } from "next-intl";
import {
    type JSX,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import * as d3 from "d3";
import * as topojson from "topojson-client";

import { useGlobal } from "@/components/globalProvider";
import TooltipMap from "@/components/tooltipMap";
import colors from "@/data/colors.json";
import continent from "@/data/continents.json";
import pays from "@/data/countries.json";
import type_data from "@/data/exports.json";
import { config } from "@/metadata/configurations";
import {
    MAP_DEFINITIONS,
    type Themes,
    type definitions,
} from "@/metadata/constants";
import { projections } from "@/metadata/geoprojections";
import type {
    ColorName,
    ContinentType,
    CountryData,
    CountryType,
    ProjectionName,
} from "@/metadata/types";
import { calculateArrowHead } from "@/utils/arrow";
import { MakeBalance } from "@/utils/balance";
import { calculateBalance } from "@/utils/balance";
import { Legend } from "@/utils/colorLegend";
import { simpleDrag } from "@/utils/drag";
import { isKnownCountry } from "@/utils/function";
import { createLegend } from "@/utils/legend";
import { applyZoomOnElement } from "@/utils/zooming";

const englishCountriesName = new Set(
    Object.values(pays).map((country) => country.en),
);

const countryCodeToNumber = new Map<string, number>();
const countryNumberToCode = new Map<number, string>();
const countryNumberToName = new Map<number, string>();
const countryNameToNumber = new Map<string, number>();
Object.entries(pays).forEach(([key, val]) => {
    countryCodeToNumber.set(val.code, Number(key));
    countryNumberToCode.set(Number(key), val.code);
    countryNumberToName.set(Number(key), val.en);
    countryNameToNumber.set(val.en, Number(key));
});

interface GlobalCountryData {
    name: string;
    feature: any;
    d: string;
    className: string;
    fill: string;
    cursor: string;
    type: "country" | "continent";
}

interface WorldMapProps {
    rawData: { [key: string]: number[][] };
    type: number;
    year: number;
    month: number;
    productsSelected: number[];
    countriesSelected: number[];
    mapDefinition: definitions;
    geoProjection: ProjectionName;
    paletteColor: ColorName;
    isAbsolute: boolean;
    isMultipleMode: boolean;
    isCountryMode: boolean;
    isStatic: boolean;
    isDaltonian: boolean;
    setCountriesSelected: (countries: number[]) => void;
    setNBCountryWithData: (nb: number) => void;
}

export function WorldMap({
    rawData,
    type,
    year,
    month,
    productsSelected,
    countriesSelected,
    mapDefinition,
    geoProjection,
    paletteColor,
    isAbsolute,
    isMultipleMode,
    isCountryMode,
    isStatic,
    isDaltonian,
    setCountriesSelected,
    setNBCountryWithData,
}: WorldMapProps): JSX.Element {
    const t = useTranslations("WorldMap");
    const { windowSize, theme } = useGlobal();

    /**
     * Refs for D3-managed elements and state (no React state to avoid re-renders on changes)
     */
    const svgRef = useRef<SVGSVGElement>(null);
    const projectionRef = useRef<d3.GeoProjection | null>(null);
    const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const legendScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
    const mapCenterRef = useRef<[number, number]>([0, 0]); // Store geographic center [lon, lat]

    /**
     * React state for interactive elements (triggers re-render on changes)
     */
    const [tooltipData, setTooltipData] = useState<{
        appear: boolean;
        country: CountryType;
        x: number;
        y: number;
    }>({
        appear: false,
        country: config.franceValue,
        x: 0,
        y: 0,
    });
    const [dataPointOnMap, setDataPointOnMap] = useState<
        Array<{
            countryName: string;
            x: number;
            y: number;
            lon: number;
            lat: number;
        }>
    >([]);
    const [mapLayer, setMapLayer] = useState<d3.Selection<
        SVGGElement,
        unknown,
        null,
        undefined
    > | null>(null);
    const [legendLayer, setLegendLayer] = useState<d3.Selection<
        SVGGElement,
        unknown,
        null,
        undefined
    > | null>(null);
    const [worldDataCache, setWorldDataCache] = useState<
        { map: any; size: definitions }[]
    >([]);

    /**
     * Memoized values and functions (re-computed only when dependencies change, stable references for D3 to avoid re-attaching handlers)
     */

    const correctionSize = useMemo<{ width: number; height: number }>(
        () => ({
            width: windowSize.width * 0.5 - 5,
            height: windowSize.height * 0.5,
        }),
        [windowSize.width, windowSize.height],
    );

    // Filter and aggregate data
    const lectureData = useMemo(() => {
        if (!rawData || !rawData[year] || productsSelected.length === 0)
            return {};

        const yearData = rawData[year];
        const dataByCountry: Record<string, Record<number, number>> = {};

        const productsSet = new Set(productsSelected);

        const N = yearData.length;
        for (let i = 0; i < N; i++) {
            const entry = yearData[i];

            // Check month match
            if (entry[2] !== month) continue;

            // Check product match
            if (!productsSet.has(entry[3])) continue;

            // Get country name and skip if not found
            const countryName = countryNumberToName.get(entry[0]);
            if (!countryName) continue;

            const typeIndex = entry[1];
            const value = entry[4] || 0;

            // Use nullish coalescing assignment
            (dataByCountry[countryName] ??= {})[typeIndex] =
                (dataByCountry[countryName][typeIndex] || 0) + value;
        }

        return dataByCountry;
    }, [rawData, year, month, productsSelected]);

    // Helper to get geographic center from planar transform
    const getGeoCenterFromTransform = useCallback(
        (
            transform: d3.ZoomTransform,
            proj: d3.GeoProjection,
        ): [number, number] | null => {
            // Screen center in untransformed coordinates
            const screenCenter: [number, number] = [
                correctionSize.width,
                correctionSize.height,
            ];
            const untransformed = transform.invert(screenCenter);
            const geoCenter = proj.invert?.(untransformed);
            return geoCenter ? [geoCenter[0], geoCenter[1]] : null;
        },
        [correctionSize],
    );

    // Helper to calculate transform that centers on a geographic point
    const getTransformForGeoCenter = useCallback(
        (
            center: [number, number],
            proj: d3.GeoProjection,
            scale: number,
        ): d3.ZoomTransform => {
            const projected = proj(center);
            if (!projected) return d3.zoomIdentity.scale(scale);
            // We want the projected point to appear at screen center
            // transform applies as: screenX = projectedX * k + x
            // So: correctionSize.width = projected[0] * scale + x => x = correctionSize.width - projected[0] * scale
            const x = correctionSize.width - projected[0] * scale;
            const y = correctionSize.height - projected[1] * scale;
            return d3.zoomIdentity.translate(x, y).scale(scale);
        },
        [correctionSize],
    );

    /**
     * Effects for D3 manipulations (runs on mount and when dependencies change, uses memoized values/functions to avoid unnecessary re-renders or re-attaching handlers)
     */

    // Effect 3: Memoized event handlers (stable references to prevent re-attaching)
    const handleCountryMouseover = useCallback(
        (event: any) => {
            const datum = event?.target?.__data__ as
                | GlobalCountryData
                | undefined;
            if (!datum || !mapLayer) return;

            // Visual feedback — use scoped arrow selection when mapLayer is available
            if (datum.type === undefined) {
                console.log("Datum without type:", datum);
                mapLayer
                    .selectAll(".data-arrow")
                    .transition()
                    .duration(config.fastAnimationDuration)
                    .attr("filter", `brightness(${config.mapBrightnessHover})`);
            } else {
                const strokeWidth =
                    2 *
                    Math.pow(
                        config.mapStrokeWidth / currentTransformRef.current.k,
                        config.mapStrokeWidthPower,
                    );
                d3.select(event.currentTarget)
                    .transition()
                    .duration(config.fastAnimationDuration)
                    .attr("stroke-width", strokeWidth)
                    .attr("filter", `brightness(${config.mapBrightnessHover})`);
            }

            // Tooltip data
            const currentCountryNumberCode = countryNameToNumber.get(
                datum.name,
            );
            if (currentCountryNumberCode === undefined) return;

            setTooltipData({
                appear: true,
                country: String(currentCountryNumberCode) as CountryType,
                x: event.pageX,
                y: event.pageY,
            });
        },
        [mapLayer, dataPointOnMap],
    );

    // Effect 4: Memoized mouseout handler (stable reference to prevent re-attaching)
    const handleCountryMouseout = useCallback(
        (event: any) => {
            const datum = event?.target?.__data__ as
                | GlobalCountryData
                | undefined;
            if (!datum || !mapLayer) return;

            if (datum.type === undefined) {
                mapLayer
                    .selectAll(".data-arrow")
                    .transition()
                    .duration(config.fastAnimationDuration)
                    .attr("filter", "brightness(1)");
            } else {
                const strokeWidth = Math.pow(
                    config.mapStrokeWidth / currentTransformRef.current.k,
                    config.mapStrokeWidthPower,
                );
                d3.select(event.currentTarget)
                    .transition()
                    .duration(config.fastAnimationDuration)
                    .attr("stroke-width", strokeWidth)
                    .attr("filter", "brightness(1)");
            }

            setTooltipData((prev) => ({ ...prev, appear: false }));
        },
        [mapLayer],
    );

    // Effect 5: Load map and draw countries (runs once on mount, then only if mode or window size changes)
    useEffect(() => {
        const abortController = new AbortController();
        const { signal } = abortController;

        const loadMap = async () => {
            console.log("Initializing map...");

            const svg = svgRef.current;
            if (!svg) return;

            // Create projection and path
            const correctProjection = projections.find(
                (p) => p.name === geoProjection,
            )!;

            const projection = correctProjection
                .value()
                .scale(config.projectionScale)
                .translate([correctionSize.width, correctionSize.height]);
            projectionRef.current = projection;

            // Clear any previous map root to avoid duplicate renderings
            const svgSel = d3.select(svg);
            svgSel.selectAll(".map-root").remove();

            // Create SVG (attach a single root group to make init idempotent)
            const mapSvg = svgSel
                .attr("width", correctionSize.width * 2)
                .attr("height", correctionSize.height * 2)
                .attr(
                    "viewBox",
                    `0 0 ${correctionSize.width * 2} ${correctionSize.height * 2}`,
                );

            const root = mapSvg.append("g").attr("class", "map-root");
            // Ensure hatch pattern defs exist for no-data overlay — defs must be on the SVG element
            createHatchPattern(mapSvg);

            const currentMapLayer = root.append("g").attr("class", "map-layer");
            setMapLayer(currentMapLayer);

            const legendLayer = root
                .append("g")
                .attr("class", "legend-layer")
                .attr(
                    "transform",
                    `translate(20, ${correctionSize.height * config.legendHeightRatio})`,
                )
                .attr("pointer-events", "none");

            const correctLegend = createLegend({
                legendLayer,
                name: t("legend", { unite: t("ton-unit") }),
            });
            setLegendLayer(correctLegend);

            try {
                // Fetch or use cached world topology data
                const cachedEntry = worldDataCache.find(
                    (entry) => entry.size === mapDefinition,
                );
                let worldData = cachedEntry?.map;
                if (!worldData) {
                    const size = MAP_DEFINITIONS[mapDefinition];
                    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                    const url = `${basePath}/world/world-${size}.json`;

                    const response = await fetch(url, { signal });
                    if (!response.ok)
                        throw new Error("Failed to load world data");
                    if (signal.aborted) return;
                    worldData = await response.json();

                    // Cache the loaded data for future use

                    setWorldDataCache((prev) => [
                        ...prev,
                        { map: worldData, size: mapDefinition },
                    ]);
                }
            } catch (error) {
                // Ignore abort errors (expected on cleanup)
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }
                d3.select(svg)
                    .append("text")
                    .attr("x", correctionSize.width)
                    .attr("y", correctionSize.height)
                    .attr("text-anchor", "middle")
                    .text(t("error-data"));
            }
        };
        loadMap();

        return () => {
            abortController.abort();
        };
    }, [
        correctionSize.height,
        correctionSize.width,
        geoProjection,
        mapDefinition,
        t,
    ]);

    // Effect 6: Load map and draw countries (runs once on mount, then only if mode or window size changes)
    useEffect(() => {
        if (
            !mapLayer ||
            mapLayer.empty() ||
            !projectionRef.current ||
            !legendLayer
        )
            return;

        const svg = svgRef.current;
        if (!svg) return;

        const worldData = worldDataCache.find(
            (entry) => entry.size === mapDefinition,
        )?.map;
        if (!worldData) return;

        const mapSvg = d3.select(svg);
        const projection = projectionRef.current;
        const pathGenerator = d3.geoPath().projection(projection);

        // Extract country features (topojson.feature always returns FeatureCollection)
        let features: CountryData[] = [];

        if (isCountryMode) {
            features = (
                topojson.feature(worldData, worldData.objects.countries) as any
            ).features;
        } else {
            // Precompute a lookup from country name -> geometry to avoid
            // filtering the full geometries array for every continent.
            const geometries = worldData.objects.countries.geometries as any[];
            const nameToGeometry = new Map<string, any>(
                geometries.map((g: any) => [g.properties.name, g]),
            );

            for (const cont of Object.keys(continent)) {
                const countriesInContinent =
                    continent[cont as ContinentType].countries;

                const geometriesToMerge: any[] = [];
                for (const c of Object.values(countriesInContinent)) {
                    const geom = nameToGeometry.get(c.en);
                    if (geom) geometriesToMerge.push(geom);
                }

                if (geometriesToMerge.length === 0) continue;

                const mergedGeometry = topojson.merge(
                    worldData,
                    geometriesToMerge,
                );

                const mergedFeature: CountryData = {
                    type: "Feature",
                    properties: {
                        name: cont,
                    },
                    geometry: mergedGeometry,
                };
                features.push(mergedFeature);
            }
        }

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent(config.scaleExtent)
            .on("zoom", (event) => {
                mapLayer.attr("transform", event.transform);

                // Update geographic center for cross-projection sync
                const geoCenter = getGeoCenterFromTransform(
                    event.transform,
                    projection,
                );
                if (geoCenter) {
                    mapCenterRef.current = geoCenter;
                }
                if (event.transform.k !== currentTransformRef.current.k)
                    applyZoomOnElement({
                        svg,
                        mapLayer: mapLayer,
                        legendLayer: legendLayer,
                        radiusScale: legendScaleRef.current!,
                        zoomScale: event.transform.k,
                        isStatic,
                        isCountryMode,
                    });

                currentTransformRef.current = event.transform;
            });

        mapLayer.selectAll(".globe-background").remove(); // Nettoie l'ancien cercle si besoin
        mapLayer.select("defs#globe-gradient-defs").remove();
        const correctGeoProjection = projections.find(
            (p) => p.name === geoProjection,
        )!;
        if (correctGeoProjection.drag) {
            // Convert geographic center to rotation for globe: rotation = [-lon, -lat, 0]
            const initialRotation: [number, number, number] = [
                -mapCenterRef.current[0],
                -mapCenterRef.current[1],
                0,
            ];
            mapSvg.call(
                simpleDrag({
                    projection,
                    pathGenerator,
                    mapLayer: mapLayer,
                    isStatic,
                    // Use unified zoom scale to sync with planar projection zoom
                    initialTransform: d3.zoomIdentity.scale(
                        currentTransformRef.current.k,
                    ),
                    initialRotation,
                    onZoomChange: (zoomScale, rotation) => {
                        // Sync unified zoom scale when globe changes
                        const currentTransform = currentTransformRef.current;
                        const newTransform = d3.zoomIdentity
                            .translate(currentTransform.x, currentTransform.y)
                            .scale(zoomScale);
                        // Convert rotation back to geographic center: center = [-rotation[0], -rotation[1]]
                        mapCenterRef.current = [-rotation[0], -rotation[1]];
                        // Also update legend
                        if (zoomScale !== currentTransformRef.current.k)
                            applyZoomOnElement({
                                svg,
                                mapLayer: mapLayer,
                                legendLayer: legendLayer,
                                radiusScale: legendScaleRef.current!,
                                zoomScale: zoomScale,
                                isStatic,
                                isCountryMode,
                                isGlobe: true,
                            });
                        currentTransformRef.current = newTransform;
                    },
                    correctionSize,
                }),
            );
        } else {
            mapSvg.call(zoom);
            // Restore view centered on mapCenterRef with unified zoom scale
            const restoredTransform = getTransformForGeoCenter(
                mapCenterRef.current,
                projection,
                currentTransformRef.current.k,
            );
            mapSvg.call(zoom.transform, restoredTransform);
        }

        mapLayer
            .selectAll(".country-layer, .circle-layer, .arrow-layer")
            .remove();

        // Draw countries
        let nbCountriesWithData = 0;
        const prepared: GlobalCountryData[] = features
            .map((f: any) => {
                const name = f.properties.name;
                const known = isKnownCountry(name, isCountryMode);
                const path = pathGenerator(f);
                if (!path) return;
                if (known) nbCountriesWithData++;
                return {
                    name: name,
                    feature: f,
                    d: pathGenerator(f),
                    className: known
                        ? "country known-country"
                        : "country unknown-country",
                    fill:
                        name === "France"
                            ? config.franceColor
                            : known
                              ? config[theme].validCountry
                              : "url(#no-data-hatch-pattern)",
                    cursor: known ? "pointer" : "default",
                    type: isCountryMode ? "country" : "continent",
                };
            })
            .filter(Boolean) as GlobalCountryData[];
        setNBCountryWithData(nbCountriesWithData);

        const countryLayer = mapLayer
            .append("g")
            .attr("class", "country-layer");

        const mergedWorldGeometry = topojson.merge(
            worldData,
            worldData.objects.countries.geometries as any[],
        );
        const mergedWorldFeature = {
            type: "Feature",
            properties: { name: "World" },
            geometry: mergedWorldGeometry,
        };

        countryLayer
            .selectAll<SVGPathElement, any>(".world-merged")
            .data([mergedWorldFeature])
            .join("path")
            .attr("class", "world-merged")
            .attr("d", (d) => pathGenerator(d as any) || "")
            .attr("fill", "url(#no-data-hatch-pattern)")
            .attr("stroke", "var(--low-border-color)")
            .attr("stroke-width", config.mapStrokeWidth)
            .attr("opacity", 1)
            .attr("pointer-events", "none");

        // Use a keyed join and update both enter + update in one merged pass
        const sel = countryLayer
            .selectAll<SVGPathElement, GlobalCountryData>(".country")
            .data(prepared, (d) => d.name);

        sel.exit().remove();

        const enter = sel
            .enter()
            .append("path")
            .attr("class", (d) => d.className)
            .attr("stroke", "var(--low-border-color)")
            .attr("stroke-width", config.mapStrokeWidth)
            .attr("filter", "brightness(1)");

        enter
            .merge(sel)
            .attr("d", (d) => d.d)
            .attr("fill", (d) => d.fill)
            .attr("opacity", (d) =>
                d.name === "France" || d.cursor === "pointer" ? 1 : 0,
            )
            .style("cursor", (d) => d.cursor);

        // Create arrow layer after countries so arrows appear on top
        mapLayer.append("g").attr("class", "circle-layer");
        mapLayer.append("g").attr("class", "arrow-layer");

        // Build a list of points with projected positions
        const pointData = features
            .map((feature: any) => {
                const countryName = feature.properties.name;
                if (isCountryMode && !englishCountriesName.has(countryName))
                    return null;

                const centroid = d3.geoCentroid(feature);
                const projectedCentroid = projection(centroid);
                if (!projectedCentroid) return null;
                return {
                    countryName,
                    lon: centroid[0],
                    lat: centroid[1],
                    x: projectedCentroid[0],
                    y: projectedCentroid[1],
                };
            })
            .filter(Boolean) as Array<{
            countryName: string;
            lon: number;
            lat: number;
            x: number;
            y: number;
        }>;
        setDataPointOnMap(pointData);
    }, [
        correctionSize,
        theme,
        mapDefinition,
        geoProjection,
        isStatic,
        isCountryMode,
        getGeoCenterFromTransform,
        getTransformForGeoCenter,
        setNBCountryWithData,
        t,
        mapLayer,
        legendLayer,
        worldDataCache,
    ]);

    // Effect 7: Ajout des gestionnaires d'événements de clic sur les pays (sélection)
    useEffect(() => {
        if (!mapLayer || mapLayer.empty()) return;

        mapLayer.selectAll(".known-country").on("click", (_: any, d: any) => {
            const countryNumberCode = countryNameToNumber.get(d.name);
            if (countryNumberCode === undefined || countryNumberCode === 103)
                return;

            if (isMultipleMode) {
                const newSelection: number[] = countriesSelected.includes(
                    countryNumberCode,
                )
                    ? countriesSelected.filter(
                          (code: number) => code !== countryNumberCode,
                      )
                    : [...countriesSelected, countryNumberCode];
                setCountriesSelected(newSelection);
            } else {
                if (countriesSelected[0] === countryNumberCode)
                    setCountriesSelected([]);
                else setCountriesSelected([countryNumberCode]);
            }
        });

        return () => {
            mapLayer.selectAll(".known-country").on("click", null);
        };
    }, [
        countriesSelected,
        isMultipleMode,
        mapLayer,
        setCountriesSelected,
        dataPointOnMap,
    ]);

    // Effect 8: Attach event handlers when map layer changes
    useEffect(() => {
        if (!mapLayer || mapLayer.empty()) return;

        // Attach handlers (handlers are stable and read from ref)
        mapLayer
            .selectAll(".known-country")
            .on("mouseover", handleCountryMouseover)
            .on("mouseout", handleCountryMouseout);

        return () => {
            mapLayer
                .selectAll(".known-country")
                .on("mouseover", null)
                .on("mouseout", null);
        };
    }, [handleCountryMouseover, handleCountryMouseout, mapLayer]);

    // Effect 9: Update map points and legend when data is in balance mode (type 4)
    // separate from other data updates for performance and because it has a different visual encoding
    useEffect(() => {
        if (
            (type !== 4 && !isAbsolute) ||
            !lectureData ||
            Object.keys(lectureData).length === 0 ||
            !mapLayer ||
            mapLayer.empty()
        )
            return;

        const svg = svgRef.current;
        if (!svg) return;

        const pointData = MakeBalance({
            lectureData,
            countries: isCountryMode ? dataPointOnMap : undefined,
            continent: !isCountryMode ? continent : undefined,
            isAbsolute,
        });
        if (pointData.length === 0) return;

        const legend = d3.select(svg).select<SVGGElement>(".legend-layer");

        legend
            .transition()
            .duration(config.animationDuration)
            .attr("opacity", "0");
        legend
            .selectAll<SVGTextElement, unknown>(".legend-text")
            .text(t("legend", { unite: t("euro-unit") }));

        let maxValue = 1;
        let minValue = 0;

        if (pointData.length > 0) {
            maxValue = 1;
            minValue = 0;

            for (const d of pointData) {
                const absValue = Math.abs(d.value);
                if (absValue > maxValue) {
                    maxValue = absValue;
                }
                if (d.value < minValue) {
                    minValue = d.value;
                }
            }
        }

        const arrowLayer = mapLayer.select<SVGGElement>(".arrow-layer");
        arrowLayer
            .selectAll<SVGPathElement, [number, number][number]>(".data-arrow")
            .transition()
            .duration(config.animationDuration)
            .attr("stroke-dashoffset", function () {
                const length = (this as SVGPathElement).getTotalLength();
                return `${length}`;
            });

        arrowLayer
            .selectAll<
                SVGPathElement,
                {
                    continentCode: string;
                    arcPoints: [number, number][];
                    value: number;
                }
            >(".arrow-head")
            .transition()
            .duration(config.animationDuration * 0.3)
            .attr("d", (d) => {
                if (d.arcPoints.length < 2) return "";

                const end = d.arcPoints[d.arcPoints.length - 1];
                const tipX = end[0];
                const tipY = end[1];

                return `M${tipX},${tipY}L${tipX},${tipY}L${tipX},${tipY}Z`;
            });

        mapLayer
            .selectAll(".data-point")
            .transition()
            .duration(config.animationDuration)
            .attr("r", 0);

        const colorScale = MakeHuexBalanceProjection(
            mapLayer,
            pointData,
            maxValue,
            minValue,
            theme,
            isDaltonian,
        );
        const colorLegend = Legend(colorScale, {
            width: 50,
            height: correctionSize.height * config.legendHeightRatio,
            ticks: 10,
            title: t("balance"),
            marginTop: 90,
            marginLeft: 25,
        });
        d3.select(svg).selectAll(".color-legend").remove();
        d3.select(svg).append(() => colorLegend);
    }, [
        correctionSize.height,
        dataPointOnMap,
        isAbsolute,
        isCountryMode,
        isDaltonian,
        lectureData,
        mapLayer,
        t,
        theme,
        type,
    ]);

    // Effect 10: Update data based on filtered data
    useEffect(() => {
        if (
            (type === 4 && !isAbsolute) || // Skip if in balance mode, handled by separate effect (Effect 7)
            !lectureData ||
            Object.keys(lectureData).length === 0 ||
            !mapLayer ||
            mapLayer.empty() ||
            !legendLayer
        )
            return;

        const svg = svgRef.current;
        if (!svg) return;

        const legend = d3.select(svg).select<SVGGElement>(".legend-layer");
        const legendTitle = legend.selectAll<SVGTextElement, unknown>(
            ".legend-text",
        );

        legend
            .transition()
            .duration(config.animationDuration)
            .attr("opacity", 1);
        d3.select(svg).selectAll(".color-legend").remove();

        legendTitle.text(
            t("legend", { unite: type <= 1 ? t("ton-unit") : t("euro-unit") }),
        );
        const countries = mapLayer.selectAll<SVGPathElement, GlobalCountryData>(
            ".known-country",
        );

        const correctProjection = projections.find(
            (p) => p.name === geoProjection,
        );
        const typeKey = type.toString() as keyof typeof type_data;
        const countryNamesWithData = new Set<string>();
        let maxValue = 1;
        const pointData: Array<{
            countryName: string;
            value: number;
            x: number;
            y: number;
            lon: number;
            lat: number;
            positive?: boolean;
        }> = [];
        if (isCountryMode) {
            for (const point of dataPointOnMap) {
                let value = lectureData[point.countryName]?.[typeKey];
                if (type === 4) {
                    const exportValue = lectureData[point.countryName]?.[2];
                    const importValue = lectureData[point.countryName]?.[3];
                    if (exportValue === undefined || importValue === undefined)
                        continue;
                    value = calculateBalance(
                        exportValue,
                        importValue,
                        isAbsolute,
                    );
                }

                if (value || value === 0) {
                    pointData.push({
                        countryName: point.countryName,
                        value: Math.abs(value),
                        lon: point.lon,
                        lat: point.lat,
                        x: point.x,
                        y: point.y,
                        ...(type === 4 ? { positive: value > 0 } : {}),
                    });
                    countryNamesWithData.add(point.countryName);

                    // Calculate max in same pass
                    if (Math.abs(value) > maxValue) {
                        maxValue = Math.abs(value);
                    }
                }
            }
            // Add France to the set (always considered as having data)
            countryNamesWithData.add("France");

            countries
                .transition()
                .duration(config.animationDuration)
                .attr("fill", (d: GlobalCountryData) => {
                    if (type !== 4) return d.fill; // For non-balance types, keep original fill
                    if (d.name === "France") return d.fill;
                    const index = pointData.findIndex(
                        (p) => p.countryName === d.name,
                    );
                    if (index === -1) {
                        return d.fill;
                    }
                    if (pointData[index]?.positive) {
                        return config.positiveColor;
                    } else {
                        return config.negativeColor;
                    }
                })
                .attr("opacity", (d: GlobalCountryData) => {
                    const hasData = countryNamesWithData.has(d.name);
                    if (hasData) {
                        return 1;
                    }
                    return 0;
                });

            legendScaleRef.current = makeCircleProjection(
                mapLayer,
                legendLayer,
                pointData,
                currentTransformRef.current.k,
                maxValue,
                handleCountryMouseover,
                handleCountryMouseout,
                paletteColor,
                correctProjection?.drag || false,
                isStatic,
            );
        } else {
            const projection = projectionRef.current;
            if (!projection) return;

            for (const [cont, values] of Object.entries(continent)) {
                let value = lectureData[cont]?.[typeKey];
                console.log(
                    `Processing continent ${cont}:`,
                    values,
                    "with value:",
                    value,
                );
                if (type === 4) {
                    const exportValue = lectureData[cont]?.[2];
                    const importValue = lectureData[cont]?.[3];
                    if (exportValue === undefined || importValue === undefined)
                        continue;
                    value = calculateBalance(
                        exportValue,
                        importValue,
                        isAbsolute,
                    );
                }
                if (value === undefined) continue;

                console.log(
                    `Continent ${cont} has value ${value} for type ${typeKey}`,
                );

                pointData.push({
                    countryName: cont,
                    value: Math.abs(value),
                    lon: values.center[0],
                    lat: values.center[1],
                    x: projection(values.center as [number, number])?.[0] || 0,
                    y: projection(values.center as [number, number])?.[1] || 0,
                    ...(type === 4 ? { positive: value > 0 } : {}),
                });
                countryNamesWithData.add(cont);
                if (Math.abs(value) > maxValue) {
                    maxValue = Math.abs(value);
                }
            }

            countries
                .transition()
                .duration(config.animationDuration)
                .attr("fill", (d: GlobalCountryData) => {
                    if (type !== 4) return d.fill; // For non-balance types, keep original fill
                    if (d.name === "France") return d.fill;
                    const index = pointData.findIndex(
                        (p) => p.countryName === d.name,
                    );
                    if (index === -1) {
                        return d.fill;
                    }
                    if (pointData[index]?.positive) {
                        return config.positiveColor;
                    } else {
                        return config.negativeColor;
                    }
                })
                .attr("opacity", (d: GlobalCountryData) => {
                    const hasData = countryNamesWithData.has(d.name);
                    if (hasData) {
                        return 1;
                    }
                    return 0;
                });

            legendScaleRef.current = makeArrowProjection(
                mapLayer,
                legendLayer,
                projection,
                pointData,
                currentTransformRef.current.k,
                maxValue,
                handleCountryMouseover,
                handleCountryMouseout,
                paletteColor,
                correctProjection?.drag || false,
                isStatic,
            );
        }
    }, [
        lectureData,
        type,
        dataPointOnMap,
        legendLayer,
        correctionSize,
        theme,
        isAbsolute,
        isStatic,
        geoProjection,
        paletteColor,
        isDaltonian,
        handleCountryMouseover,
        handleCountryMouseout,
        mapLayer,
        t,
        isCountryMode,
    ]);

    return (
        <div className="world-map-container">
            <svg
                ref={svgRef}
                className={`root-svg ${projections.find((p) => p.name === geoProjection)?.drag ? "globe" : ""}`}
            />
            <TooltipMap
                countriesValues={lectureData}
                position={{
                    x: tooltipData.x,
                    y: tooltipData.y,
                }}
                country={tooltipData.country}
                year={year}
                month={month}
                appear={tooltipData.appear}
                rawData={rawData}
                productsSelected={productsSelected}
                countryNumberToName={countryNumberToName}
            />
        </div>
    );
}

function createHatchPattern(
    root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    id: string = "no-data-hatch",
    color: string = "var(--bg)",
): void {
    const defs = root.select<SVGDefsElement>(`defs#${id}`);
    if (!defs.empty()) return; // already created
    const newDefs = root.append("defs").attr("id", id);

    const pattern = newDefs
        .append("pattern")
        .attr("id", id + "-pattern")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 8)
        .attr("height", 8)
        .attr("patternTransform", "rotate(45)");

    pattern
        .append("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", color);

    pattern
        .append("path")
        .attr("d", "M0,0 L0,8")
        .attr("stroke", "var(--fg)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.6);
}

function makeCircleProjection(
    mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    legendLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    pointData: Array<{
        countryName: string;
        value: number;
        x: number;
        y: number;
    }>,
    zoom: number,
    maxValue: number,
    onMouseover: (event: any) => void,
    onMouseout: (event: any) => void,
    palette: ColorName,
    isGlobe: boolean = false,
    isStatic: boolean = false,
): d3.ScaleLinear<number, number, never> {
    const radiusScale = d3.scaleLinear().domain([0, maxValue]).range([0, 30]);
    // When isStatic, divide radius by zoom to keep constant visual size
    const legendZoom = isStatic ? 1 : zoom;

    const effectiveRadius = (d: { value: number }) =>
        isStatic
            ? isGlobe
                ? radiusScale(d.value)
                : radiusScale(d.value) / zoom
            : isGlobe
              ? radiusScale(d.value) * zoom
              : radiusScale(d.value);

    legendLayer
        .selectAll(".legend-circle, .legend-label, .legend-tick, .legend-line")
        .remove();

    const legendValues = [maxValue, maxValue / 2, maxValue / 4];

    const legendCircleX = Math.max(
        config.legendCircleBaseX +
            config.legendCircleXFactor * (legendZoom - 1),
        config.legendCircleBaseX,
    );
    legendLayer
        .selectAll(".legend-circle")
        .data(legendValues)
        .enter()
        .append("circle")
        .attr("class", "legend-circle")
        .attr("cx", legendCircleX)
        .attr("cy", (d) => config.legendYposition - radiusScale(d) * legendZoom)
        .attr("r", (d) => radiusScale(d) * legendZoom)
        .attr("opacity", 0.7)
        .attr("stroke-width", 1)
        .attr("fill", colors[palette].fill)
        .attr("stroke", colors[palette].stroke);

    legendLayer
        .selectAll(".legend-tick")
        .data(legendValues)
        .enter()
        .append("line")
        .attr("class", "legend-tick")
        .attr("x1", legendCircleX)
        .attr(
            "y1",
            (d) => config.legendYposition - radiusScale(d) * legendZoom * 2,
        )
        .attr("x2", config.legendCircleBaseY)
        .attr(
            "y2",
            (d) => config.legendYposition - radiusScale(d) * legendZoom * 2,
        )
        .attr("stroke", "var(--fg)")
        .attr("stroke-width", config.circleStrokeWidth);

    legendLayer
        .selectAll(".legend-label")
        .data(legendValues)
        .enter()
        .append("text")
        .attr("class", "legend-label")
        .attr("x", 10)
        .attr(
            "y",
            (d) =>
                config.legendYposition -
                radiusScale(d) * legendZoom * 2 +
                config.legendLabelOffset,
        )
        .attr("fill", "var(--fg)")
        .attr("font-size", 12)
        .text(
            (d) =>
                Number((d / 1000).toFixed(0)).toLocaleString("en-FR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }) + " 000",
        );

    const circleLayer = mapLayer.select<SVGGElement>(".circle-layer");
    // Bind data to circles (only countries with data)
    const circles = circleLayer
        .selectAll<SVGCircleElement, (typeof pointData)[number]>(".data-point")
        .data(pointData, (d) => d.countryName);
    circles
        .exit()
        .transition()
        .duration(config.animationDuration)
        .attr("r", 0)
        .remove();

    // Enter + Update
    circles
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", 0)
        .attr("fill", colors[palette].fill)
        .attr("opacity", 0.7)
        .attr("stroke", colors[palette].stroke)
        .attr("stroke-width", config.circleStrokeWidth)
        .style("cursor", "pointer")
        .transition()
        .duration(config.animationDuration)
        .attr("r", effectiveRadius);

    circles
        .transition()
        .duration(config.animationDuration)
        .attr("r", effectiveRadius)
        .attr("fill", colors[palette].fill)
        .attr("stroke", colors[palette].stroke);

    // Attach hover handlers to circles
    mapLayer
        .selectAll(".data-point")
        .on("mouseover", onMouseover)
        .on("mouseout", onMouseout);

    return radiusScale;
}

function makeArrowProjection(
    mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    legendLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null,
    projection: d3.GeoProjection,
    pointData: Array<{
        countryName: string;
        value: number;
        x: number;
        y: number;
    }>,
    zoom: number,
    maxValue: number,
    onMouseover: (event: any) => void,
    onMouseout: (event: any) => void,
    palette: ColorName,
    isGlobe: boolean = false,
    isStatic: boolean = false,
): d3.ScaleLinear<number, number, never> {
    const continents = Object.keys(continent);

    const effectiveRadius = (d: number) =>
        isStatic
            ? isGlobe
                ? strokeScale(d)
                : strokeScale(d) / zoom
            : isGlobe
              ? strokeScale(d) * zoom
              : strokeScale(d);

    // Build arcs and associated data for each continent
    const arcsData = continents
        .map((cont) => {
            const continentInfo = continent[cont as keyof typeof continent];
            const center = continentInfo.center as [number, number];
            // Center is in [lat, lon] format, but d3.geoInterpolate needs [lon, lat]
            const targetGeoCoords: [number, number] = [center[1], center[0]];

            // Find the value for this continent from pointData
            const pointDataItem = pointData.find((d) => d.countryName === cont);
            const value = pointDataItem?.value || 0;

            if (!value) return null;

            // Create interpolation in geographic coordinates (lon, lat)
            const interpolate = d3.geoInterpolate(
                config.parisCoord,
                targetGeoCoords,
            );

            // Generate arc points by interpolating and then projecting to screen coordinates
            // Use fine sampling (0.01 = 100 points) to handle arcs that cross behind the globe
            const arcPoints = d3
                .range(0, 1.001, 0.01)
                .map((t) => {
                    const geoCoords = interpolate(t);
                    return projection(geoCoords as [number, number]);
                })
                .filter((point): point is [number, number] => !!point);

            return {
                continentCode: cont,
                arcPoints,
                value,
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

    const line = d3
        .line<[number, number]>()
        .curve(d3.curveBasis)
        .defined((d) => !!d);

    const strokeScale = d3.scaleLinear().domain([0, maxValue]).range([1.5, 6]);

    const arrowLayer = mapLayer.select<SVGGElement>(".arrow-layer");
    const arrowPath = arrowLayer
        .selectAll<SVGPathElement, (typeof arcsData)[number]>(".data-arrow")
        .data(arcsData, (d) => d.continentCode);

    arrowPath
        .exit()
        .transition("exit")
        .duration(config.animationDuration)
        .attr("stroke-dashoffset", function () {
            const length = (this as SVGPathElement).getTotalLength();
            return `${length}`;
        })
        .remove();

    const arrowEnter = arrowPath
        .enter()
        .append("path")
        .attr("class", "data-arrow")
        .attr("fill", "none")
        .attr("stroke", colors[palette].fill)
        .attr("d", (d) => line(d.arcPoints) || "")
        .attr("stroke-dasharray", function () {
            const length = (this as SVGPathElement).getTotalLength();
            return `${length}`;
        })
        .attr("stroke-dashoffset", function () {
            const length = (this as SVGPathElement).getTotalLength();
            return `${length}`;
        });

    arrowEnter
        .merge(arrowPath)
        .attr("stroke-width", (d) => effectiveRadius(d.value))
        .attr("stroke", colors[palette].fill)
        .transition("update")
        .duration(config.animationDuration)
        .attr("stroke-dashoffset", "0");

    // Create/Update custom arrowheads as separate paths
    const arrowheads = arrowLayer
        .selectAll<SVGPathElement, (typeof arcsData)[number]>(".arrow-head")
        .data(arcsData, (d) => d.continentCode);

    arrowheads
        .exit()
        .transition("exit-head")
        .duration(config.animationDuration * 0.2)
        .attr("d", function (this: SVGPathElement) {
            const d = d3.select(this).datum() as (typeof arcsData)[number];
            if (d.arcPoints.length < 2) return "";
            const end = d.arcPoints[d.arcPoints.length - 1];
            const tipX = end[0];
            const tipY = end[1];
            return `M${tipX},${tipY}L${tipX},${tipY}L${tipX},${tipY}Z`;
        })
        .remove();

    const arrowheadSize = isStatic
        ? config.arrowHeadSize / zoom
        : config.arrowHeadSize; // Base size of arrowhead, scaled down when static
    const arrowheadEnter = arrowheads
        .enter()
        .append("path")
        .attr("class", "arrow-head data-arrow")
        .attr("fill", colors[palette].fill)
        .attr("stroke", "none");

    arrowheadEnter
        .merge(arrowheads)
        .attr("fill", colors[palette].fill)
        .attr("d", (d) => {
            if (d.arcPoints.length < 2) return "";

            const end = d.arcPoints[d.arcPoints.length - 1];
            const tipX = end[0];
            const tipY = end[1];

            return `M${tipX},${tipY}L${tipX},${tipY}L${tipX},${tipY}Z`;
        })
        .transition("update-head")
        .delay(config.animationDuration * 0.9) // Start fading in near the end of arrow animation
        .duration(config.animationDuration * 0.2)
        .attr("d", (d) => calculateArrowHead(d, arrowheadSize, maxValue));

    arrowheadEnter
        .transition("enter-head")
        .delay(config.animationDuration * 0.9) // Start fading in near the end of arrow animation
        .duration(config.animationDuration * 0.2)
        .attr("d", (d) => calculateArrowHead(d, arrowheadSize, maxValue));

    // Attach hover handlers to both arrows and arrowheads
    mapLayer
        .selectAll(".data-arrow")
        .on("mouseover", onMouseover)
        .on("mouseout", onMouseout);

    if (legendLayer) {
        legendLayer
            .selectAll(
                ".legend-line, .legend-label, .legend-circle, .legend-tick",
            )
            .remove();

        const legendValues = [maxValue, maxValue / 2, maxValue / 4];
        legendLayer
            .selectAll(".legend-line")
            .data(legendValues)
            .enter()
            .append("line")
            .attr("class", "legend-line")
            .attr("x1", 80)
            .attr(
                "y1",
                (d, i) =>
                    config.legendLineBaseY +
                    config.legendLineSpacing * i +
                    (effectiveRadius(d) * (i - 2)) / 2,
            )
            .attr("x2", 125)
            .attr(
                "y2",
                (d, i) =>
                    config.legendLineBaseY +
                    config.legendLineSpacing * i +
                    (effectiveRadius(d) * (i - 2)) / 2,
            )
            .attr("stroke", colors[palette].fill)
            .attr("stroke-width", (d) => effectiveRadius(d));

        legendLayer
            .selectAll(".legend-label")
            .data(legendValues)
            .enter()
            .append("text")
            .attr("class", "legend-label")
            .attr("x", 10)
            .attr(
                "y",
                (d, i) =>
                    config.legendLineBaseY +
                    config.legendLineSpacing * i +
                    (effectiveRadius(d) * (i - 2)) / 2,
            )
            .attr("fill", "var(--fg)")
            .attr("font-size", 12)
            .text(
                (d) =>
                    Number((d / 1000).toFixed(0)).toLocaleString("en-FR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                    }) + " 000",
            );
    }
    return strokeScale;
}

function MakeHuexBalanceProjection(
    mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    pointData: Array<{
        countryName: string;
        value: number;
        x: number;
        y: number;
    }>,
    maxValue: number,
    minValue: number,
    theme: Themes = "light",
    isDaltonian: boolean = false,
): d3.ScaleLinear<string, string, never> {
    // Use colorblind-friendly palette (orange-white-purple) when isDaltonian is true
    const colorRange: [string, string, string] = isDaltonian
        ? ["#d95f02", "#f7f7f7", "#7570b3"] // Orange - White - Purple (colorblind-safe)
        : ["#ff0000", "#ffffff", "#0011ff"]; // Red - White - Blue (default)

    const colorScale = d3
        .scaleLinear<string>()
        .domain([minValue, 0, maxValue])
        .range(colorRange);

    // Put veridis for colorblind users

    const countries = mapLayer.selectAll<SVGPathElement, GlobalCountryData>(
        ".known-country",
    );

    countries
        .transition()
        .duration(config.animationDuration)
        .attr("fill", (d: GlobalCountryData) => {
            const countryName = d.name;
            const point = pointData.find((p) => p.countryName === countryName);
            const isCountry = isKnownCountry(countryName, true);
            if (countryName === "France") return config.franceColor;
            return point
                ? colorScale(point.value)
                : isCountry
                  ? config[theme].nullCountry
                  : config[theme].invalidCountry;
        });
    return colorScale;
}
