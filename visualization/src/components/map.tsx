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

import type_data from "@/data/N027_LIB.json";
import { ColorName } from "@/data/colorElement";
import { colors } from "@/data/colorElement";
import {
    MAP_DEFINITIONS,
    type Themes,
    type definitions,
} from "@/data/constants";
import continent from "@/data/continent.json";
import pays from "@/data/country.json";
import { projections } from "@/data/geoprojection";
import type { CountryData, CountryType } from "@/data/types";
import { MakeBalance } from "@/utils/balance";
import { Legend } from "@/utils/colorLegend";
import { simpleDrag } from "@/utils/drag";
import { isKnownCountry } from "@/utils/function";

import { useGlobal } from "./globalProvider";
import TooltipMap from "./tooltipMap";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const pays_english = new Set(Object.values(pays).map((country) => country.en));
const animationDuration = 800;
const ParisCoord: [number, number] = [2.3522, 48.8566];

const config = {
    legendHeight: 130,
    legendWidth: 150,
    legendMaxHeight: 250,
    legendMaxWidth: 300,
    light: {
        validCountry: "#87ceeb",
        invalidCountry: "#d3d3d3",
        nullCountry: "#d8dee6",
    },
    dark: {
        validCountry: "#116383",
        invalidCountry: "#666",
        nullCountry: "#40404a",
    },
    projectionScale: 310,
    scaleExtent: [0.5, 10] as [number, number],
};

interface WorldMapProps {
    allData: { [key: string]: number[][] };
    type: number;
    year: number;
    month: number;
    productsSelected: number[];
    countriesSelected: number[];
    isMultipleMode: boolean;
    isCountryMode: boolean;
    mapDefinition: definitions;
    isAbsolute: boolean;
    geoProjection: string;
    isStatic: boolean;
    isDaltonian: boolean;
    paletteColor: ColorName;
    setCountriesSelected: (countries: number[]) => void;
    setNBCountryWithData: (nb: number) => void;
}

export function WorldMap({
    allData,
    type,
    year,
    month,
    productsSelected,
    countriesSelected,
    isMultipleMode,
    isCountryMode = false,
    mapDefinition,
    isAbsolute,
    geoProjection,
    isStatic,
    isDaltonian,
    paletteColor,
    setCountriesSelected,
    setNBCountryWithData,
}: WorldMapProps): JSX.Element {
    const t = useTranslations("WorldMap");
    const { windowSize, theme } = useGlobal();

    const correctionSize = useMemo<[number, number]>(
        () => [windowSize.width / 2 - 5, windowSize.height / 2],
        [windowSize.width, windowSize.height],
    );

    const svgRef = useRef<SVGSVGElement>(null);
    const worldDataCache = useRef<{ map: any; size: definitions }[]>([]);
    // Token to cancel stale async initializations (prevents double append)
    const loadTokenRef = useRef(0);
    const projectionRef = useRef<d3.GeoProjection | null>(null);
    const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const legendScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
    // Unified zoom scale that works across both projection types
    const unifiedZoomScaleRef = useRef<number>(1);
    // Store geographic center [lon, lat] for preserving view across projection changes
    const mapCenterRef = useRef<[number, number]>(ParisCoord);

    // Helper to get geographic center from planar transform
    const getGeoCenterFromTransform = useCallback(
        (
            transform: d3.ZoomTransform,
            proj: d3.GeoProjection,
        ): [number, number] | null => {
            // Screen center in untransformed coordinates
            const screenCenter: [number, number] = [
                correctionSize[0],
                correctionSize[1],
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
            // So: correctionSize[0] = projected[0] * scale + x => x = correctionSize[0] - projected[0] * scale
            const x = correctionSize[0] - projected[0] * scale;
            const y = correctionSize[1] / 2 - projected[1] * scale;
            return d3.zoomIdentity.translate(x, y).scale(scale);
        },
        [correctionSize],
    );

    const [tooltipData, setTooltipData] = useState<{
        appear: boolean;
        year: number;
        month: number;
        country: CountryType;
    }>({ appear: false, year: 0, month: 0, country: "103" });
    const [tooltipPosition, setTooltipPosition] = useState<{
        x: number;
        y: number;
    }>({ x: 0, y: 0 });
    const [dataPointOnMap, setDataPointOnMap] = useState<
        Array<{
            countryName: string;
            x: number;
            y: number;
            lon: number;
            lat: number;
        }>
    >([]);
    const [layer, setLayer] = useState<d3.Selection<
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

    // Effect 1: Filter and aggregate data using useMemo (no extra render)
    const lectureData = useMemo(() => {
        if (!allData || !allData[year]) return {};

        const yearData = allData[year];
        const dataByCountry: {
            [key: string]: Record<string, number>;
        } = {};

        // Convert to Set for O(1) lookup (faster than array.includes)
        const productsSet =
            productsSelected.length > 0 ? new Set(productsSelected) : null;
        const L = yearData.length;

        // Single pass: filter and aggregate in one loop (no intermediate array)
        for (let i = 0; i < L; i++) {
            const entry = yearData[i];

            // Early exit: check month first (fastest check)
            if (entry[2] !== month) continue;

            // Check product match
            const productMatch = productsSet
                ? productsSet.has(entry[3])
                : entry[3] === 0;
            if (!productMatch) continue;

            // Get country name and skip if not found
            const countryName =
                pays[entry[0].toString() as keyof typeof pays]?.en;
            if (!countryName) continue;

            const typeIndex = entry[1].toString();
            const value = entry[4] || 0;

            // Initialize country object if needed
            if (!dataByCountry[countryName]) {
                dataByCountry[countryName] = {};
            }

            // Aggregate values (sum if multiple entries per country/type)
            dataByCountry[countryName][typeIndex] =
                (dataByCountry[countryName][typeIndex] || 0) + value;
        }

        return dataByCountry;
    }, [allData, year, month, productsSelected]);

    // Effect 2: Apply the zoom on the legend (stable reference to prevent re-attaching)
    const applyLegendZoom = useCallback(
        (
            legend: d3.Selection<SVGGElement, unknown, null, undefined>,
            zoomScale: number,
            radiusScale: d3.ScaleLinear<number, number>,
        ) => {
            if (!legend) return;
            if (isStatic) zoomScale = 1;
            const baseY = 110;
            legend
                .selectAll<SVGCircleElement, number>(".legend-circle")
                .attr("r", (d) => radiusScale(d) * zoomScale)
                .attr("cy", (d) => baseY - radiusScale(d) * zoomScale)
                .attr("cx", () => Math.max(100 + 50 * (zoomScale - 1), 100));

            if (isCountryMode)
                legend
                    .selectAll<SVGTextElement, number>(".legend-label")
                    .attr(
                        "y",
                        (d) => baseY - radiusScale(d) * zoomScale * 2 + 5,
                    );
            else
                legend
                    .selectAll<SVGTextElement, number>(".legend-label")
                    .attr(
                        "y",
                        (d, i) =>
                            45 +
                            25 * i +
                            (radiusScale(d) * zoomScale * (i - 2)) / 2,
                    );

            legend
                .selectAll<SVGLineElement, number>(".legend-line")
                .attr(
                    "y1",
                    (d, i) =>
                        45 +
                        25 * i +
                        (radiusScale(d) * zoomScale * (i - 2)) / 2,
                )
                .attr(
                    "y2",
                    (d, i) =>
                        45 +
                        25 * i +
                        (radiusScale(d) * zoomScale * (i - 2)) / 2,
                )
                .attr("stroke-width", (d) => radiusScale(d) * zoomScale);

            legend
                .selectAll<SVGLineElement, number>(".legend-tick")
                .attr("y1", (d) => baseY - radiusScale(d) * zoomScale * 2)
                .attr("y2", (d) => baseY - radiusScale(d) * zoomScale * 2)
                .attr("x1", () => Math.max(100 + 50 * (zoomScale - 1), 100));

            const element = legend
                .select<SVGGElement>(function () {
                    return (this as SVGGElement).parentNode as SVGGElement;
                })
                .selectAll<SVGRectElement, unknown>(".legend-background");
            const clipRect = legend
                .select<SVGGElement>(function () {
                    return (this as SVGGElement).parentNode as SVGGElement;
                })
                .selectAll<SVGRectElement, unknown>(".legend-clip-rect");
            const legendText = legend
                .select<SVGGElement>(function () {
                    return (this as SVGGElement).parentNode as SVGGElement;
                })
                .selectAll<SVGTextElement, unknown>(".legend-text");

            let rectWidth = config.legendWidth;
            let rectHeight = config.legendHeight;
            if (isCountryMode) {
                rectWidth = Math.max(
                    Math.min(
                        config.legendWidth * zoomScale ** 0.6,
                        config.legendMaxWidth,
                    ),
                    config.legendWidth,
                );
                rectHeight = Math.max(
                    Math.min(
                        config.legendHeight * zoomScale ** 0.6,
                        config.legendMaxHeight,
                    ),
                    config.legendHeight,
                );
            } else {
                rectWidth = Math.max(
                    Math.min(
                        config.legendWidth * zoomScale ** 0.18,
                        config.legendMaxWidth,
                    ),
                    config.legendWidth,
                );
                rectHeight = Math.max(
                    Math.min(
                        config.legendHeight * zoomScale ** 0.18,
                        config.legendMaxHeight,
                    ),
                    config.legendHeight,
                );
            }
            element
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("x", 0)
                .attr("y", config.legendHeight - rectHeight);
            clipRect
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("x", 0)
                .attr("y", config.legendHeight - rectHeight);

            legendText
                .attr("x", 10)
                .attr("y", -rectHeight + config.legendHeight + 25);
        },
        [isCountryMode, isStatic],
    );

    // Effect 3: Memoized event handlers (stable references to prevent re-attaching)
    const handleCountryMouseover = useCallback(
        (event: any) => {
            console.log("Mouseover on country:", event.target.__data__);
            // Visual feedback

            if (event.target.__data__.continentCode) {
                d3.select(event.currentTarget).attr("opacity", (d: any) => {
                    return isKnownCountry(d.continentCode, isCountryMode)
                        ? 0.6
                        : 1;
                });
                d3.selectAll(".data-arrow").attr("opacity", (d: any) => {
                    if (d.continentCode !== event.target.__data__.continentCode)
                        return 1;
                    return 0.6;
                });
            } else
                d3.select(event.currentTarget)
                    .attr("stroke-width", (d: any) => {
                        return isKnownCountry(d.properties.name, isCountryMode)
                            ? 1.5
                            : 0.5;
                    })
                    .attr("opacity", (d: any) => {
                        return isKnownCountry(d.properties.name, isCountryMode)
                            ? 0.6
                            : 1;
                    });

            // Tooltip data (read from ref to get current data)
            let currentCountryNumberCode: string | undefined = undefined;
            if (event.target.__data__.properties) {
                const currentCountryName =
                    event.target.__data__.properties.name;
                currentCountryNumberCode = Object.keys(pays).find(
                    (key) =>
                        pays[key as keyof typeof pays].en ===
                        currentCountryName,
                );
            } else if (event.target.__data__.continentCode) {
                const continentCode = event.target.__data__.continentCode;
                currentCountryNumberCode = Object.keys(pays).find(
                    (key) =>
                        pays[key as keyof typeof pays].code === continentCode,
                );
            }
            console.log("Identified country code:", currentCountryNumberCode);
            if (!currentCountryNumberCode) return;

            setTooltipData({
                appear: true,
                year,
                month,
                country: currentCountryNumberCode as CountryType,
            });
            setTooltipPosition({
                x: event.pageX,
                y: event.pageY,
            });
        },
        [isCountryMode, year, month],
    );

    // Effect 4: Memoized mouseout handler (stable reference to prevent re-attaching)
    const handleCountryMouseout = useCallback((event: any) => {
        if (event.target.__data__.continentCode) {
            d3.selectAll(".data-arrow").attr("opacity", 1);
        } else
            d3.select(event.currentTarget)
                .attr("stroke-width", 0.5)
                .attr("opacity", 1);
        setTooltipData((prev) => ({ ...prev, appear: false }));
    }, []);

    // Effect 5: Load map and draw countries (runs once on mount, then only if mode or window size changes)
    useEffect(() => {
        const loadMap = async () => {
            console.log("Initializing map...");
            // Mark this async init with a token
            const token = ++loadTokenRef.current;
            const svg = svgRef.current;
            if (!svg) return;

            // Create projection and path
            const correctProjection = projections.find(
                (p) => p.name === geoProjection,
            );
            if (!correctProjection) return;

            const projection = correctProjection
                .value()
                .scale(config.projectionScale)
                .translate(correctionSize);
            projectionRef.current = projection;

            const pathGenerator = d3.geoPath().projection(projection);

            // Clear any previous map root to avoid duplicate renderings
            // (use a single root group so repeated inits remove prior map)
            const svgSel = d3.select(svg);
            svgSel.selectAll(".map-root").remove();

            try {
                // Fetch or use cached world topology data
                const worldDataCached = worldDataCache.current;
                const cachedEntry = worldDataCached.find(
                    (entry) => entry.size === mapDefinition,
                );
                let worldData = cachedEntry?.map;
                if (!worldData) {
                    const size = MAP_DEFINITIONS[mapDefinition];
                    const url = `${basePath}/world/world-${size}.json`;
                    const response = await fetch(url);
                    if (!response.ok)
                        throw new Error("Failed to load world data");
                    worldData = await response.json();

                    worldDataCache.current.push({
                        map: worldData,
                        size: mapDefinition,
                    });
                }

                // If another load started after this one, abort this init
                if (token !== loadTokenRef.current) return;

                // Extract country features (topojson.feature always returns FeatureCollection)
                let features: CountryData[] = [];

                if (isCountryMode) {
                    features = (
                        topojson.feature(
                            worldData,
                            worldData.objects.countries,
                        ) as any
                    ).features;
                } else {
                    Object.keys(continent).forEach((cont) => {
                        const countriesInContinent =
                            continent[cont as keyof typeof continent].countries;

                        const countriesSet = new Set(
                            Object.entries(countriesInContinent).map(
                                ([, value]) => value.en,
                            ),
                        );

                        const geometriesToMerge =
                            worldData.objects.countries.geometries.filter(
                                (g: any) => countriesSet.has(g.properties.name),
                            );

                        if (!geometriesToMerge.length) return;

                        const mergedGeometry = topojson.merge(
                            worldData,
                            geometriesToMerge,
                        );

                        const continentName = Object.keys(pays).find(
                            (value) => {
                                return (
                                    pays[value as keyof typeof pays].code ===
                                    cont
                                );
                            },
                        );

                        const mergedFeature: CountryData = {
                            type: "Feature",
                            properties: {
                                name:
                                    pays[continentName as keyof typeof pays]
                                        .en || cont,
                            },
                            geometry: mergedGeometry,
                        };
                        features.push(mergedFeature);
                    });
                }

                // Create SVG (attach a single root group to make init idempotent)
                const mapSvg = svgSel
                    .attr("width", windowSize.width - 10)
                    .attr("height", windowSize.height)
                    .attr(
                        "viewBox",
                        `0 0 ${windowSize.width - 10} ${windowSize.height}`,
                    );

                const root = mapSvg.append("g").attr("class", "map-root");

                const mapLayer = root.append("g").attr("class", "map-layer");

                const legendLayer = root
                    .append("g")
                    .attr("class", "legend-layer")
                    .attr(
                        "transform",
                        `translate(20, ${windowSize.height * 0.8})`,
                    )
                    .attr("pointer-events", "none");

                const correctLegend = createLegend(
                    legendLayer,
                    t("legend", { unite: t("ton-unit") }),
                );

                setLayer(mapLayer);
                setLegendLayer(correctLegend);

                const zoom = d3
                    .zoom<SVGSVGElement, unknown>()
                    .scaleExtent(config.scaleExtent)
                    .on("zoom", (event) => {
                        mapLayer.attr("transform", event.transform);
                        currentTransformRef.current = event.transform;
                        // Update unified zoom scale for cross-projection sync
                        unifiedZoomScaleRef.current = event.transform.k;

                        // Update geographic center for cross-projection sync
                        const geoCenter = getGeoCenterFromTransform(
                            event.transform,
                            projection,
                        );
                        if (geoCenter) {
                            mapCenterRef.current = geoCenter;
                        }

                        applyLegendZoom(
                            correctLegend,
                            event.transform.k,
                            legendScaleRef.current!,
                        );

                        // Keep data points at constant visual size when isStatic
                        if (isStatic && legendScaleRef.current) {
                            mapLayer
                                .selectAll<SVGCircleElement, any>(".data-point")
                                .attr(
                                    "r",
                                    (d) =>
                                        legendScaleRef.current!(d.value) /
                                        event.transform.k,
                                );
                            mapLayer
                                .selectAll<SVGLineElement, any>(".data-arrow")
                                .attr(
                                    "stroke-width",
                                    (d) =>
                                        legendScaleRef.current!(d.value) /
                                        event.transform.k,
                                );

                            const arrowHeadSelection = mapLayer.selectAll<
                                SVGPathElement,
                                any
                            >(".arrow-head");

                            const max =
                                d3.max(
                                    arrowHeadSelection.data(),
                                    (d) => d.value,
                                ) || 1;

                            arrowHeadSelection.attr("d", (d) =>
                                calculateArrowHead(
                                    d,
                                    17 / event.transform.k,
                                    max,
                                ),
                            );
                        }
                    });

                if (correctProjection.drag) {
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
                            mapLayer,
                            projectionScale: config.projectionScale,
                            scaleExtent: config.scaleExtent,
                            isStatic,
                            legendScale: legendScaleRef.current!,
                            // Use unified zoom scale to sync with planar projection zoom
                            initialTransform: d3.zoomIdentity.scale(
                                unifiedZoomScaleRef.current,
                            ),
                            initialRotation,
                            onZoomChange: (zoomScale, rotation) => {
                                // Sync unified zoom scale when globe changes
                                unifiedZoomScaleRef.current = zoomScale;
                                // Convert rotation back to geographic center: center = [-rotation[0], -rotation[1]]
                                mapCenterRef.current = [
                                    -rotation[0],
                                    -rotation[1],
                                ];
                                // Also update legend
                                applyLegendZoom(
                                    correctLegend,
                                    zoomScale,
                                    legendScaleRef.current!,
                                );
                            },
                        }),
                    );
                } else {
                    mapSvg.call(zoom);
                    // Restore view centered on mapCenterRef with unified zoom scale
                    const restoredTransform = getTransformForGeoCenter(
                        mapCenterRef.current,
                        projection,
                        unifiedZoomScaleRef.current,
                    );
                    mapSvg.call(zoom.transform, restoredTransform);
                }

                // Draw countries
                mapLayer
                    .selectAll(".country")
                    .data(features)
                    .enter()
                    .append("path")
                    .attr("class", (d: any) => {
                        return isKnownCountry(
                            d.properties.name,
                            isCountryMode,
                        ) || d.properties.name === "France"
                            ? "country known-country"
                            : "country";
                    })
                    .attr("d", pathGenerator as any)
                    .attr("fill", (d: any) => {
                        return d.properties.name === "France"
                            ? "#ff6b6b"
                            : isKnownCountry(d.properties.name, isCountryMode)
                              ? config[theme].validCountry
                              : config[theme].invalidCountry;
                    })
                    .attr("stroke", "var(--low-border-color)")
                    .attr("stroke-width", 0.5)
                    .style("cursor", (d: any) => {
                        return isKnownCountry(d.properties.name, isCountryMode)
                            ? "pointer"
                            : "default";
                    });

                // Create arrow layer after countries so arrows appear on top
                mapLayer.append("g").attr("class", "arrow-layer");

                // Build a list of points with projected positions
                const pointData = features
                    .map((feature: any) => {
                        const countryName = feature.properties.name;
                        if (
                            isCountryMode &&
                            !pays_english.has(countryName) &&
                            countryName !== "France"
                        )
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
            } catch {
                d3.select(svg)
                    .append("text")
                    .attr("x", correctionSize[0])
                    .attr("y", correctionSize[1])
                    .attr("text-anchor", "middle")
                    .text(t("error-data"));
            }
        };
        loadMap();
    }, [
        applyLegendZoom,
        correctionSize,
        getGeoCenterFromTransform,
        getTransformForGeoCenter,
        isCountryMode,
        windowSize.height,
        windowSize.width,
        mapDefinition,
        theme,
        geoProjection,
        isStatic,
        legendScaleRef,
    ]);

    // Effect 6: Ajout des gestionnaires d'événements de clic sur les pays (sélection)
    useEffect(() => {
        if (!layer) return;

        layer.selectAll(".country").on("click", (_: any, d: any) => {
            const countryCode = Object.keys(pays).find(
                (key) =>
                    pays[key as keyof typeof pays].en === d.properties.name,
            );
            if (!countryCode) return;

            const correctNumberCode = Number(countryCode);
            if (isMultipleMode) {
                const newSelection: number[] = countriesSelected.includes(
                    correctNumberCode,
                )
                    ? countriesSelected.filter(
                          (code: number) => code !== correctNumberCode,
                      )
                    : [...countriesSelected, correctNumberCode];
                setCountriesSelected(newSelection);
            } else {
                if (countriesSelected[0] === correctNumberCode)
                    setCountriesSelected([]);
                else setCountriesSelected([correctNumberCode]);
            }
        });
    }, [
        countriesSelected,
        isMultipleMode,
        layer,
        lectureData,
        setCountriesSelected,
        type,
    ]);

    // Effect 7: Attach event handlers when map layer changes
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const mapLayer =
            layer ?? d3.select(svg).select<SVGGElement>(".map-layer");
        if (mapLayer.empty()) return;

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
    }, [handleCountryMouseover, handleCountryMouseout, layer]);

    // Effect 8: Update data based on filtered data
    useEffect(() => {
        if (!lectureData || Object.keys(lectureData).length === 0) return;

        const svg = svgRef.current;
        if (!svg) return;

        d3.select(svg).selectAll(".color-legend").remove();
        const mapLayer =
            layer ?? d3.select(svg).select<SVGGElement>(".map-layer");
        if (mapLayer.empty()) return;

        const legend = d3.select(svg).select<SVGGElement>(".legend-layer");
        legend.transition().duration(animationDuration).attr("opacity", "1");

        const legendTitle = legend.selectAll<SVGTextElement, unknown>(
            ".legend-text",
        );

        if (type === 4) {
            legend
                .transition()
                .duration(animationDuration)
                .attr("opacity", "0");
            legendTitle.text(t("legend", { unite: t("euro-unit") }));

            const pointData = MakeBalance({
                lectureData,
                countries: isCountryMode ? dataPointOnMap : undefined,
                continent: !isCountryMode ? continent : undefined,
                isAbsolute,
            });

            const maxValue = Math.max(
                ...pointData.map((d) => Math.abs(d.value)),
                1,
            );
            const minValue = Math.min(...pointData.map((d) => d.value), 0);

            const arrowLayer = mapLayer.select<SVGGElement>(".arrow-layer");
            const arrows = arrowLayer.selectAll<
                SVGPathElement,
                [number, number][number]
            >(".data-arrow");

            arrows
                .transition()
                .duration(animationDuration)
                .attr("stroke-dashoffset", function () {
                    const length = (this as SVGPathElement).getTotalLength();
                    return `${length}`;
                });

            const headArrows = arrowLayer.selectAll<
                SVGPathElement,
                {
                    continentCode: string;
                    arcPoints: [number, number][];
                    value: number;
                }
            >(".arrow-head");

            headArrows
                .transition()
                .duration(animationDuration * 0.3)
                .attr("d", (d) => {
                    if (d.arcPoints.length < 2) return "";

                    const end = d.arcPoints[d.arcPoints.length - 1];
                    const tipX = end[0];
                    const tipY = end[1];

                    return `M${tipX},${tipY}L${tipX},${tipY}L${tipX},${tipY}Z`;
                });

            const circles = mapLayer.selectAll<
                SVGCircleElement,
                (typeof pointData)[number]
            >(".data-point");

            circles.transition().duration(animationDuration).attr("r", 0);

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
                height: windowSize.height * 0.8,
                ticks: 10,
                title: t("balance"),
                marginTop: 60,
                marginLeft: 25,
            });
            d3.select(svg).append(() => colorLegend);
            return;
        }
        console.log(
            legendTitle,
            "new value:",
            t("legend", { unite: type <= 1 ? t("ton-unit") : t("euro-unit") }),
            type,
        );
        legendTitle.text(
            t("legend", { unite: type <= 1 ? t("ton-unit") : t("euro-unit") }),
        );
        const countries = mapLayer.selectAll<
            SVGPathElement,
            {
                countryName: string;
                value: number;
                x: number;
                y: number;
            }
        >(".country");

        const correctProjection = projections.find(
            (p) => p.name === geoProjection,
        );
        if (isCountryMode) {
            const typeKey = type.toString() as keyof typeof type_data;
            // Build point data ONLY for countries with values
            let newNBCountryWithData = 0;
            const pointData = dataPointOnMap
                .map((point) => {
                    const countryName = point.countryName;
                    const value = lectureData[countryName]?.[typeKey];

                    newNBCountryWithData++;
                    if (!value && value !== 0) return null;
                    return {
                        countryName,
                        value,
                        lon: point.lon,
                        lat: point.lat,
                        x: point.x,
                        y: point.y,
                    };
                })
                .filter(Boolean) as Array<{
                countryName: string;
                value: number;
                x: number;
                y: number;
                lon: number;
                lat: number;
            }>;
            setNBCountryWithData(newNBCountryWithData);

            countries
                .transition()
                .duration(animationDuration)
                .attr("fill", (d: any) => {
                    const isData = pointData.find(
                        (p) => p.countryName === d.properties.name,
                    );
                    return d.properties.name === "France"
                        ? "#ff6b6b"
                        : isKnownCountry(d.properties.name, isCountryMode)
                          ? isData !== undefined
                              ? config[theme].validCountry
                              : config[theme].nullCountry
                          : config[theme].invalidCountry;
                });

            // Find max value for scaling
            const maxValue = Math.max(...pointData.map((d) => d.value), 1);

            legendScaleRef.current = makeCircleProjection(
                mapLayer,
                legendLayer,
                pointData,
                currentTransformRef.current.k,
                maxValue,
                applyLegendZoom,
                handleCountryMouseover,
                handleCountryMouseout,
                paletteColor,
                correctProjection?.drag || false,
                isStatic,
            );
        } else {
            const projection = projectionRef.current;
            if (!projection) return;

            let newNBCountryWithData = 0;
            const pointData = Object.entries(continent)
                .map(([cont, values]) => {
                    const countryCode = Object.keys(pays).find(
                        (key) => pays[key as keyof typeof pays].code === cont,
                    );
                    const countryName =
                        pays[countryCode as keyof typeof pays]?.en || cont;

                    const value =
                        lectureData[countryName]?.[
                            type.toString() as keyof typeof type_data
                        ];
                    newNBCountryWithData++;
                    if (!value) return null;

                    return {
                        countryName: cont,
                        value: value,
                        x:
                            projection(
                                values.center as [number, number],
                            )?.[0] || 0,
                        y:
                            projection(
                                values.center as [number, number],
                            )?.[1] || 0,
                        lon: values.center[0],
                        lat: values.center[1],
                    };
                })
                .filter(Boolean) as Array<{
                countryName: string;
                value: number;
                x: number;
                y: number;
                lon: number;
                lat: number;
            }>;
            setNBCountryWithData(newNBCountryWithData);

            countries
                .transition()
                .duration(animationDuration)
                .attr("fill", (d: any) => {
                    const findNumberCode = Object.keys(pays).find(
                        (key) =>
                            pays[key as keyof typeof pays].en ===
                            d.properties.name,
                    );
                    const isData = pointData.find(
                        (p) =>
                            p.countryName ===
                            pays[findNumberCode as keyof typeof pays]?.code,
                    );
                    return isKnownCountry(d.properties.name, isCountryMode)
                        ? isData !== undefined
                            ? config[theme].validCountry
                            : config[theme].nullCountry
                        : config[theme].invalidCountry;
                });

            const maxValue = Math.max(...pointData.map((d) => d.value), 1);
            legendScaleRef.current = makeArrowProjection(
                mapLayer,
                legendLayer,
                projection,
                pointData,
                currentTransformRef.current.k,
                maxValue,
                applyLegendZoom,
                handleCountryMouseover,
                handleCountryMouseout,
                paletteColor,
                correctProjection?.drag || false,
                isStatic,
            );
        }
    }, [
        applyLegendZoom,
        lectureData,
        type,
        dataPointOnMap,
        legendLayer,
        windowSize.height,
        isCountryMode,
        handleCountryMouseover,
        handleCountryMouseout,
        theme,
        isAbsolute,
        isStatic,
        geoProjection,
        paletteColor,
        isDaltonian,
    ]);

    return (
        <div className="world-map-container">
            <svg ref={svgRef} />
            <TooltipMap
                usefullData={lectureData}
                position={tooltipPosition}
                country={tooltipData.country}
                year={tooltipData.year}
                month={tooltipData.month}
                appear={tooltipData.appear}
            />
        </div>
    );
}

function createLegend(
    legendLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    name: string = "Légende :",
): d3.Selection<SVGGElement, unknown, null, undefined> {
    const clipId = "legend-clip";

    const defs = legendLayer.append("defs");
    defs.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", config.legendWidth)
        .attr("height", config.legendHeight)
        .attr("rx", 8)
        .attr("class", "legend-clip-rect");

    legendLayer
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", config.legendWidth)
        .attr("height", config.legendHeight)
        .attr("rx", 8)
        .attr("fill", "var(--bg-legend)")
        .attr("stroke", "var(--border-color)")
        .attr("class", "legend-background");

    legendLayer
        .append("text")
        .attr("x", 10)
        .attr("y", 25)
        .attr("fill", "var(--fg)")
        .attr("font-size", 18)
        .attr("class", "legend-text")
        .text(name);

    const innerLegend = legendLayer
        .append("g")
        .attr("class", "inner-legend")
        .attr("clip-path", `url(#${clipId})`)
        .attr("transform", `translate(0, 10)`);

    return innerLegend;
}

function makeCircleProjection(
    mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
    legendLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null,
    pointData: Array<{
        countryName: string;
        value: number;
        x: number;
        y: number;
    }>,
    zoom: number,
    maxValue: number,
    applyZoom: (
        legend: d3.Selection<SVGGElement, unknown, null, undefined>,
        zoomScale: number,
        radiusScale: d3.ScaleLinear<number, number, never>,
    ) => void,
    onMouseover: (event: any) => void,
    onMouseout: (event: any) => void,
    palette: ColorName,
    isGlobe: boolean = false,
    isStatic: boolean = false,
): d3.ScaleLinear<number, number, never> {
    console.log("Nouvelle couleur de palette pour les cercles :", palette);
    const radiusScale = d3.scaleLinear().domain([0, maxValue]).range([0, 30]);
    // When isStatic, divide radius by zoom to keep constant visual size
    const effectiveRadius = (d: { value: number }) =>
        isStatic
            ? isGlobe
                ? radiusScale(d.value)
                : radiusScale(d.value) / zoom
            : isGlobe
              ? radiusScale(d.value) * zoom
              : radiusScale(d.value);

    if (legendLayer) {
        legendLayer
            .selectAll(".legend-circle, .legend-label, .legend-tick")
            .remove();

        const legendValues = [maxValue, maxValue / 2, maxValue / 4];

        legendLayer
            .selectAll(".legend-circle")
            .data(legendValues)
            .enter()
            .append("circle")
            .attr("class", "legend-circle")
            .attr("cx", 100)
            .attr("cy", (d) => 110 - radiusScale(d))
            .attr("r", (d) => radiusScale(d))
            .attr("fill", colors[palette].fill)
            .attr("opacity", 0.7)
            .attr("stroke", colors[palette].stroke)
            .attr("stroke-width", 1);

        legendLayer
            .selectAll(".legend-tick")
            .data(legendValues)
            .enter()
            .append("line")
            .attr("class", "legend-tick")
            .attr("x1", 100)
            .attr("y1", (d) => 110 - radiusScale(d) * 2)
            .attr("x2", 65)
            .attr("y2", (d) => 110 - radiusScale(d) * 2)
            .attr("stroke", "var(--fg)")
            .attr("stroke-width", 1);

        legendLayer
            .selectAll(".legend-label")
            .data(legendValues)
            .enter()
            .append("text")
            .attr("class", "legend-label")
            .attr("x", 10)
            .attr("y", (d) => 115 - radiusScale(d) * 2)
            .attr("fill", "var(--fg)")
            .attr("font-size", 12)
            .text(
                (d) =>
                    Number((d / 1000).toFixed(0)).toLocaleString("en-FR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                    }) + " 000",
            );

        applyZoom(legendLayer, zoom, radiusScale);
    }

    // Bind data to circles (only countries with data)
    const circles = mapLayer
        .selectAll<SVGCircleElement, (typeof pointData)[number]>(".data-point")
        .data(pointData, (d) => d.countryName);
    circles
        .exit()
        .transition()
        .duration(animationDuration)
        .attr("r", 0)
        .remove();

    // Enter + Update
    console.log(colors[palette].fill);
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
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .transition()
        .duration(animationDuration)
        .attr("r", effectiveRadius);

    circles
        .transition()
        .duration(animationDuration)
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
    applyZoom: (
        legend: d3.Selection<SVGGElement, unknown, null, undefined>,
        zoomScale: number,
        strokeScale: d3.ScaleLinear<number, number, never>,
    ) => void,
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
            const interpolate = d3.geoInterpolate(ParisCoord, targetGeoCoords);

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
        .duration(animationDuration)
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
        .duration(animationDuration)
        .attr("stroke-dashoffset", "0");

    // Create/Update custom arrowheads as separate paths
    const arrowheads = arrowLayer
        .selectAll<SVGPathElement, (typeof arcsData)[number]>(".arrow-head")
        .data(arcsData, (d) => d.continentCode);

    arrowheads
        .exit()
        .transition("exit-head")
        .duration(animationDuration * 0.2)
        .attr("d", function (this: SVGPathElement) {
            const d = d3.select(this).datum() as (typeof arcsData)[number];
            if (d.arcPoints.length < 2) return "";
            const end = d.arcPoints[d.arcPoints.length - 1];
            const tipX = end[0];
            const tipY = end[1];
            return `M${tipX},${tipY}L${tipX},${tipY}L${tipX},${tipY}Z`;
        })
        .remove();

    const arrowheadSize = isStatic ? 17 / zoom : 17; // Base size of arrowhead, scaled down when static
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
        .delay(animationDuration * 0.9) // Start fading in near the end of arrow animation
        .duration(animationDuration * 0.2)
        .attr("d", (d) => calculateArrowHead(d, arrowheadSize, maxValue));

    arrowheadEnter
        .transition("enter-head")
        .delay(animationDuration * 0.9) // Start fading in near the end of arrow animation
        .duration(animationDuration * 0.2)
        .attr("d", (d) => calculateArrowHead(d, arrowheadSize, maxValue));

    // Attach hover handlers to both arrows and arrowheads
    mapLayer
        .selectAll(".data-arrow")
        .on("mouseover", onMouseover)
        .on("mouseout", onMouseout);

    if (legendLayer) {
        legendLayer.selectAll(".legend-line, .legend-label").remove();

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
                (d, i) => 45 + 25 * i + (effectiveRadius(d) * (i - 2)) / 2,
            )
            .attr("x2", 125)
            .attr(
                "y2",
                (d, i) => 45 + 25 * i + (effectiveRadius(d) * (i - 2)) / 2,
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
                (d, i) => 45 + 25 * i + (effectiveRadius(d) * (i - 2)) / 2,
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

        applyZoom(legendLayer, zoom, strokeScale);
    }
    return strokeScale;
}

function calculateArrowHead(
    d: {
        arcPoints: [number, number][];
        value: number;
    },
    arrowheadSize: number,
    maxValue: number,
): string {
    if (d.arcPoints.length < 2) return "";

    const end = d.arcPoints[d.arcPoints.length - 1];
    const prev = d.arcPoints[d.arcPoints.length - 2];

    // Calculate angle for arrowhead rotation
    const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);

    // Create arrowhead triangle points
    const size = 3 + arrowheadSize * (d.value / maxValue) ** 0.5; // Scale size by value (sqrt for better visual distribution)
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

    return `M${p1X},${p1Y}L${p2X},${p2Y}L${p3X},${p3Y}Z`;
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

    const countries = mapLayer.selectAll<
        SVGPathElement,
        (typeof pointData)[number]
    >(".country");

    countries
        .transition()
        .duration(animationDuration)
        .attr("fill", (d: any) => {
            const countryName = d.properties.name;
            const point = pointData.find((p) => p.countryName === countryName);
            const isCountry = isKnownCountry(countryName, true);
            return point
                ? colorScale(point.value)
                : isCountry
                  ? config[theme].nullCountry
                  : config[theme].invalidCountry;
        });
    return colorScale;
}
