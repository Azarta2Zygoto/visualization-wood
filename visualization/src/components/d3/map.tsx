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
import {
    MAP_DEFINITIONS,
    type Themes,
    type definitions,
} from "@/metadata/constants";
import { projections } from "@/metadata/geoprojections";
import { config } from "@/metadata/mapConfig";
import type {
    ColorName,
    ContinentType,
    CountryData,
    CountryType,
    ProjectionName,
} from "@/metadata/types";
import { calculateArrowHead } from "@/utils/arrow";
import { MakeBalance } from "@/utils/balance";
import { Legend } from "@/utils/colorLegend";
import { simpleDrag } from "@/utils/drag";
import { isKnownCountry } from "@/utils/function";
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
    const worldDataCache = useRef<{ map: any; size: definitions }[]>([]);
    const loadTokenRef = useRef(0); // Token to cancel stale async initializations (prevents double append)
    const projectionRef = useRef<d3.GeoProjection | null>(null);
    const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const legendScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
    const mapCenterRef = useRef<[number, number]>([0, 0]); // Store geographic center [lon, lat]

    /**
     * React state for interactive elements (triggers re-render on changes)
     */
    const [tooltipData, setTooltipData] = useState<{
        appear: boolean;
        year: number;
        month: number;
        country: CountryType;
        x: number;
        y: number;
    }>({ appear: false, year: 0, month: 0, country: "103", x: 0, y: 0 });
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
                            ? 1.5 / currentTransformRef.current.k ** 0.5
                            : config.mapStrokeWidth /
                                  currentTransformRef.current.k ** 0.25;
                    })
                    .attr("opacity", (d: any) => {
                        return isKnownCountry(d.properties.name, isCountryMode)
                            ? 0.6
                            : 1;
                    });

            // Tooltip data (read from ref to get current data)
            const currentCountryNumberCode =
                countryNameToNumber.get(
                    event.target.__data__.properties?.name,
                ) ??
                countryCodeToNumber.get(event.target.__data__.continentCode);

            if (currentCountryNumberCode === undefined) return;

            setTooltipData({
                appear: true,
                year,
                month,
                country: String(currentCountryNumberCode) as CountryType,
                x: event.pageX,
                y: event.pageY,
            });
        },
        [isCountryMode, year, month, dataPointOnMap],
    );

    // Effect 4: Memoized mouseout handler (stable reference to prevent re-attaching)
    const handleCountryMouseout = useCallback((event: any) => {
        if (event.target.__data__.continentCode) {
            d3.selectAll(".data-arrow").attr("opacity", 1);
        } else
            d3.select(event.currentTarget)
                .attr(
                    "stroke-width",
                    config.mapStrokeWidth /
                        currentTransformRef.current.k ** 0.25,
                )
                .attr("opacity", 1);
        setTooltipData((prev) => ({ ...prev, appear: false }));
    }, []);

    // Effect 5: Load map and draw countries (runs once on mount, then only if mode or window size changes)
    useEffect(() => {
        const abortController = new AbortController();
        const { signal } = abortController;

        const loadMap = async () => {
            console.log("Initializing map...");
            // Mark this async init with a token
            const token = ++loadTokenRef.current;
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

            const pathGenerator = d3.geoPath().projection(projection);

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

            const correctLegend = createLegend(
                legendLayer,
                t("legend", { unite: t("ton-unit") }),
            );
            setLegendLayer(correctLegend);

            try {
                // Fetch or use cached world topology data
                const cachedEntry = worldDataCache.current.find(
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
                            continent[cont as ContinentType].countries;

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

                        const continentCodeNumber =
                            countryCodeToNumber.get(cont);
                        if (!continentCodeNumber) return;

                        const mergedFeature: CountryData = {
                            type: "Feature",
                            properties: {
                                name:
                                    pays[
                                        String(
                                            continentCodeNumber,
                                        ) as CountryType
                                    ].en || cont,
                            },
                            geometry: mergedGeometry,
                        };
                        features.push(mergedFeature);
                    });
                }

                const zoom = d3
                    .zoom<SVGSVGElement, unknown>()
                    .scaleExtent(config.scaleExtent)
                    .on("zoom", (event) => {
                        currentMapLayer.attr("transform", event.transform);

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
                                mapLayer: currentMapLayer,
                                legendLayer: correctLegend,
                                radiusScale: legendScaleRef.current!,
                                zoomScale: event.transform.k,
                                isStatic,
                                isCountryMode,
                            });

                        currentTransformRef.current = event.transform;
                    });
                currentMapLayer.selectAll(".globe-background").remove(); // Nettoie l'ancien cercle si besoin
                currentMapLayer.select("defs#globe-gradient-defs").remove();
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
                            mapLayer: currentMapLayer,
                            projectionScale: config.projectionScale,
                            scaleExtent: config.scaleExtent,
                            isStatic,
                            // Use unified zoom scale to sync with planar projection zoom
                            initialTransform: d3.zoomIdentity.scale(
                                currentTransformRef.current.k,
                            ),
                            initialRotation,
                            onZoomChange: (zoomScale, rotation) => {
                                // Sync unified zoom scale when globe changes
                                const currentTransform =
                                    currentTransformRef.current;
                                const newTransform = d3.zoomIdentity
                                    .translate(
                                        currentTransform.x,
                                        currentTransform.y,
                                    )
                                    .scale(zoomScale);
                                // Convert rotation back to geographic center: center = [-rotation[0], -rotation[1]]
                                mapCenterRef.current = [
                                    -rotation[0],
                                    -rotation[1],
                                ];
                                // Also update legend
                                if (zoomScale !== currentTransformRef.current.k)
                                    applyZoomOnElement({
                                        mapLayer: currentMapLayer,
                                        legendLayer: correctLegend,
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

                // Draw countries
                currentMapLayer
                    .selectAll(".country")
                    .data(features)
                    .enter()
                    .append("path")
                    .attr("class", (d: any) => {
                        return isKnownCountry(d.properties.name, isCountryMode)
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
                    .attr("stroke-width", config.mapStrokeWidth)
                    .style("cursor", (d: any) => {
                        return isKnownCountry(d.properties.name, isCountryMode)
                            ? "pointer"
                            : "default";
                    });

                // Create arrow layer after countries so arrows appear on top
                currentMapLayer.append("g").attr("class", "arrow-layer");

                // Build a list of points with projected positions
                const pointData = features
                    .map((feature: any) => {
                        const countryName = feature.properties.name;
                        if (
                            isCountryMode &&
                            !englishCountriesName.has(countryName) &&
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
        correctionSize,
        theme,
        mapDefinition,
        geoProjection,
        isStatic,
        isCountryMode,
        getGeoCenterFromTransform,
        getTransformForGeoCenter,
        t,
    ]);

    // Effect 6: Ajout des gestionnaires d'événements de clic sur les pays (sélection)
    useEffect(() => {
        if (!mapLayer || mapLayer.empty()) return;

        mapLayer.selectAll(".known-country").on("click", (_: any, d: any) => {
            const countryNumberCode = countryNameToNumber.get(
                d.properties.name,
            );
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
    }, [
        countriesSelected,
        isMultipleMode,
        mapLayer,
        setCountriesSelected,
        dataPointOnMap,
    ]);

    // Effect 7: Attach event handlers when map layer changes
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

    useEffect(() => {
        if (
            type !== 4 ||
            !lectureData ||
            Object.keys(lectureData).length === 0 ||
            !mapLayer ||
            mapLayer.empty()
        )
            return;

        const svg = svgRef.current;
        if (!svg) return;

        const legend = d3.select(svg).select<SVGGElement>(".legend-layer");

        legend
            .transition()
            .duration(config.animationDuration)
            .attr("opacity", "0");
        legend
            .selectAll<SVGTextElement, unknown>(".legend-text")
            .text(t("legend", { unite: t("euro-unit") }));

        const pointData = MakeBalance({
            lectureData,
            countries: isCountryMode ? dataPointOnMap : undefined,
            continent: !isCountryMode ? continent : undefined,
            isAbsolute,
        });
        if (pointData.length === 0) return;

        const maxValue = Math.max(
            ...pointData.map((d) => Math.abs(d.value)),
            1,
        );
        const minValue = Math.min(...pointData.map((d) => d.value), 0);

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
            marginTop: 60,
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

    // Effect 8: Update data based on filtered data
    useEffect(() => {
        if (
            type === 4 || // Skip if in balance mode, handled by separate effect (Effect 7)
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
            .attr("opacity", "1");
        d3.select(svg).selectAll(".color-legend").remove();

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
                .duration(config.animationDuration)
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
                .duration(config.animationDuration)
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
        isCountryMode,
        theme,
        isAbsolute,
        isStatic,
        geoProjection,
        paletteColor,
        isDaltonian,
        handleCountryMouseover,
        handleCountryMouseout,
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
        .attr("fill", "var(--on-map)")
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
        .selectAll(".legend-circle, .legend-label, .legend-tick")
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
        .attr("stroke-width", 1);

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

    // Bind data to circles (only countries with data)
    const circles = mapLayer
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
        .attr("stroke-width", 1)
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

    const countries = mapLayer.selectAll<
        SVGPathElement,
        (typeof pointData)[number]
    >(".country");

    countries
        .transition()
        .duration(config.animationDuration)
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
