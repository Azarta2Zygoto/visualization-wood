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
import continent from "@/data/continent.json";
import pays from "@/data/country_extended.json";
import type { CountryData } from "@/data/types";
import { MakeBalance } from "@/utils/balance";
import { Legend } from "@/utils/colorLegend";

import { useGlobal } from "./globalProvider";
import TooltipMap from "./tooltipMap";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const pays_english = new Set(Object.values(pays).map((country) => country.en));
const animationDuration = 800;
const ParisCoord: [number, number] = [2.3522, 48.8566];

interface WorldMapProps {
    allData: { [key: string]: number[][] };
    type: number;
    year: number;
    month: number;
    productsSelected: number[];
    countriesSelected: number[];
    isMultipleMode: boolean;
    isCountryMode: boolean;
    setCountriesSelected: (countries: number[]) => void;
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
    setCountriesSelected,
}: WorldMapProps): JSX.Element {
    const t = useTranslations("WorldMap");
    const { windowSize } = useGlobal();

    const correctionSize: [number, number] = [
        windowSize.width / 2 - 1,
        windowSize.height / 2,
    ] as const;

    const svgRef = useRef<SVGSVGElement>(null);
    const worldDataCache = useRef<any>(null);
    const projectionRef = useRef<d3.GeoProjection | null>(null);
    const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const legendScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);

    const [tooltipData, setTooltipData] = useState<{
        appear: boolean;
        year: number;
        month: number;
        country: string;
        value: number;
    }>({ appear: false, year: 0, month: 0, country: "", value: 0 });
    const [tooltipPosition, setTooltipPosition] = useState<{
        x: number;
        y: number;
    }>({ x: 0, y: 0 });
    const [dataPointOnMap, setDataPointOnMap] = useState<
        Array<{
            countryName: string;
            x: number;
            y: number;
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
        ) => {
            const radiusScale = legendScaleRef.current;
            if (!radiusScale) return;

            const baseY = 50 + 30 * 2;

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

            if (isCountryMode) {
                const rectWidth = Math.max(
                    Math.min(140 * zoomScale ** 0.75, 300),
                    140,
                );
                const rectHeight = Math.max(
                    Math.min(130 * zoomScale ** 0.75, 250),
                    130,
                );

                element
                    .attr("width", rectWidth)
                    .attr("height", rectHeight)
                    .attr("x", 0)
                    .attr("y", -rectHeight + 110);
                clipRect
                    .attr("width", rectWidth)
                    .attr("height", rectHeight)
                    .attr("x", 0)
                    .attr("y", -rectHeight + 110);

                legendText.attr("x", 10).attr("y", -rectHeight + 135);
            } else {
                const rectWidth = Math.max(
                    Math.min(140 * zoomScale ** 0.18, 300),
                    140,
                );
                const rectHeight = Math.max(
                    Math.min(130 * zoomScale ** 0.18, 250),
                    130,
                );
                element
                    .attr("width", rectWidth)
                    .attr("height", rectHeight)
                    .attr("x", 0)
                    .attr("y", -rectHeight + 110);
                clipRect
                    .attr("width", rectWidth)
                    .attr("height", rectHeight)
                    .attr("x", 0)
                    .attr("y", -rectHeight + 110);

                legendText.attr("x", 10).attr("y", -rectHeight + 135);
            }
        },
        [isCountryMode],
    );

    // Effect 3: Memoized event handlers (stable references to prevent re-attaching)
    const handleCountryMouseover = useCallback(
        (event: any) => {
            // Visual feedback

            if (event.target.__data__.continentCode) {
                d3.select(event.currentTarget).attr("opacity", (d: any) => {
                    const know = isCountryMode
                        ? pays_english.has(d.properties.name) ||
                          d.properties.name === "France"
                        : true;
                    return know ? 0.6 : 1;
                });
                d3.selectAll(".data-arrow").attr("opacity", (d: any) => {
                    if (d.continentCode !== event.target.__data__.continentCode)
                        return 1;
                    return 0.6;
                });
            } else
                d3.select(event.currentTarget)
                    .attr("stroke-width", (d: any) => {
                        const know = isCountryMode
                            ? pays_english.has(d.properties.name) ||
                              d.properties.name === "France"
                            : true;
                        return know ? 1.5 : 0.5;
                    })
                    .attr("opacity", (d: any) => {
                        const know = isCountryMode
                            ? pays_english.has(d.properties.name) ||
                              d.properties.name === "France"
                            : true;
                        return know ? 0.6 : 1;
                    });

            // Tooltip data (read from ref to get current data)
            let currentCountryName = "";
            if (event.target.__data__.properties) {
                currentCountryName = event.target.__data__.properties.name;
            } else if (event.target.__data__.continentCode) {
                const continentCode = event.target.__data__.continentCode;
                const continentInt = Object.keys(pays).find(
                    (key) =>
                        pays[key as keyof typeof pays].code === continentCode,
                ) as string;
                currentCountryName =
                    pays[continentInt as keyof typeof pays]?.en ||
                    continentCode;
            }
            if (!lectureData[currentCountryName] && isCountryMode) return;

            const typeKey = type.toString() as keyof typeof type_data;
            setTooltipData({
                appear: true,
                year,
                month,
                country: currentCountryName,
                value: lectureData[currentCountryName][typeKey] || 0,
            });
            setTooltipPosition({
                x: event.pageX,
                y: event.pageY,
            });
        },
        [lectureData, isCountryMode, type, year, month],
    );

    // Effect 4: Memoized mouseout handler (stable reference to prevent re-attaching)
    const handleCountryMouseout = useCallback((event: any) => {
        console.log("Mouse out:", event.target.__data__);
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
            const svg = svgRef.current;
            if (!svg) return;

            // Save current transform before clearing
            const savedTransform = currentTransformRef.current;

            // Create projection and path
            const projection = d3
                .geoNaturalEarth1()
                .scale(310)
                .translate(correctionSize);
            projectionRef.current = projection;

            const pathGenerator = d3.geoPath().projection(projection);

            // Clear any existing content
            d3.select(svg).selectAll("*").remove();

            try {
                // Fetch or use cached world topology data
                let worldData = worldDataCache.current;
                if (!worldData) {
                    const url = `${basePath}/world/world-110m.json`;
                    const response = await fetch(url);
                    if (!response.ok)
                        throw new Error("Failed to load world data");
                    worldData = await response.json();
                    worldDataCache.current = worldData;
                }

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

                // Create SVG
                const mapSvg = d3
                    .select(svg)
                    .attr("width", windowSize.width - 2)
                    .attr("height", windowSize.height)
                    .attr(
                        "viewBox",
                        `0 0 ${windowSize.width - 2} ${windowSize.height}`,
                    );

                const mapLayer = mapSvg.append("g").attr("class", "map-layer");

                const legendLayer = mapSvg
                    .append("g")
                    .attr("class", "legend-layer")
                    .attr(
                        "transform",
                        `translate(20, ${windowSize.height * 0.8})`,
                    )
                    .attr("pointer-events", "none");

                const correctLegend = createLegend(legendLayer, t("legend"));

                setLayer(mapLayer);
                setLegendLayer(correctLegend);

                const zoom = d3
                    .zoom<SVGSVGElement, unknown>()
                    .scaleExtent([0.5, 10])
                    .on("zoom", (event) => {
                        mapLayer.attr("transform", event.transform);
                        currentTransformRef.current = event.transform;
                        applyLegendZoom(correctLegend, event.transform.k);
                    });

                mapSvg.call(zoom);

                // Restore previous transform
                if (
                    (savedTransform && savedTransform.k !== 1) ||
                    savedTransform.x !== 0 ||
                    savedTransform.y !== 0
                ) {
                    mapSvg.call(zoom.transform, savedTransform);
                }

                // Draw countries
                mapLayer
                    .selectAll(".country")
                    .data(features)
                    .enter()
                    .append("path")
                    .attr("class", (d: any) => {
                        const know = isCountryMode
                            ? pays_english.has(d.properties.name)
                            : true;
                        return know ? "country known-country" : "country";
                    })
                    .attr("d", pathGenerator as any)
                    .attr("fill", (d: any) => {
                        const know = isCountryMode
                            ? pays_english.has(d.properties.name)
                            : true;
                        return d.properties.name === "France"
                            ? "#ff6b6b"
                            : know
                              ? "#87ceeb"
                              : "#d3d3d3";
                    })
                    .attr("stroke", "#999")
                    .attr("stroke-width", 0.5)
                    .style("cursor", (d: any) => {
                        const know = isCountryMode
                            ? pays_english.has(d.properties.name)
                            : true;
                        return know ? "pointer" : "default";
                    })
                    .style("cursor", (d: any) => {
                        const know = isCountryMode
                            ? pays_english.has(d.properties.name)
                            : true;
                        return know ? "pointer" : "default";
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
                            x: projectedCentroid[0],
                            y: projectedCentroid[1],
                        };
                    })
                    .filter(Boolean) as Array<{
                    countryName: string;
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
    }, [applyLegendZoom, isCountryMode, windowSize.height, windowSize.width]);

    // Effect 6: Ajout des gestionnaires d'événements de clic sur les pays (sélection)
    useEffect(() => {
        if (!layer) return;

        layer.selectAll(".country").on("click", (_: any, d: any) => {
            const countryName = d.properties.name;
            const countryCode = Object.keys(pays).find(
                (key) => pays[key as keyof typeof pays].en === countryName,
            );
            if (!countryCode) return;

            if (isMultipleMode) {
                const newSelection: number[] = countriesSelected.includes(
                    Number(countryCode),
                )
                    ? countriesSelected.filter(
                          (code: number) => code !== Number(countryCode),
                      )
                    : [...countriesSelected, Number(countryCode)];
                setCountriesSelected(newSelection);
            } else setCountriesSelected([Number(countryCode)]);
        });
    }, [countriesSelected, isMultipleMode, layer, setCountriesSelected]);

    // Effect 7: Attach event handlers once when map loads
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const mapLayer = d3.select(svg).select<SVGGElement>(".map-layer");
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
    }, [handleCountryMouseover, handleCountryMouseout]);

    // Effect 8: Update data circles based on filtered data
    useEffect(() => {
        if (!lectureData || Object.keys(lectureData).length === 0) return;

        const svg = svgRef.current;
        if (!svg) return;

        d3.select(svg).selectAll(".color-legend").remove();
        const mapLayer = d3.select(svg).select<SVGGElement>(".map-layer");
        if (mapLayer.empty()) return;

        const legend = d3.select(svg).select<SVGGElement>(".legend-layer");
        legend.transition().duration(animationDuration).attr("opacity", "1");

        if (type === 4) {
            legend
                .transition()
                .duration(animationDuration)
                .attr("opacity", "0");

            const pointData = MakeBalance({
                lectureData,
                countries: isCountryMode ? dataPointOnMap : undefined,
                continent: !isCountryMode ? continent : undefined,
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
            );
            console.log("Color scale domain:", colorScale.domain());
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

        const countries = mapLayer.selectAll<
            SVGPathElement,
            {
                countryName: string;
                value: number;
                x: number;
                y: number;
            }
        >(".country");
        countries
            .transition()
            .duration(animationDuration)
            .attr("fill", (d: any) => {
                const know = isCountryMode
                    ? pays_english.has(d.properties.name)
                    : true;
                return d.properties.name === "France"
                    ? "#ff6b6b"
                    : know
                      ? "#87ceeb"
                      : "#d3d3d3";
            });

        if (isCountryMode) {
            const typeKey = type.toString() as keyof typeof type_data;
            // Build point data ONLY for countries with values
            const pointData = dataPointOnMap
                .map((point) => {
                    const countryName = point.countryName;
                    const value = lectureData[countryName]?.[typeKey];

                    if (!value) return null;
                    return {
                        countryName,
                        value,
                        x: point.x,
                        y: point.y,
                    };
                })
                .filter(Boolean) as Array<{
                countryName: string;
                value: number;
                x: number;
                y: number;
            }>;

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
            );
        } else {
            const projection = projectionRef.current;
            if (!projection) return;

            const pointData = Object.entries(continent).map(
                ([cont, values]) => {
                    const countryCode = Object.keys(pays).find(
                        (key) => pays[key as keyof typeof pays].code === cont,
                    );
                    const countryName =
                        pays[countryCode as keyof typeof pays]?.en || cont;

                    return {
                        countryName: cont,
                        value:
                            lectureData[countryName]?.[
                                type.toString() as keyof typeof type_data
                            ] || 0,
                        x:
                            projection(
                                values.center as [number, number],
                            )?.[0] || 0,
                        y:
                            projection(
                                values.center as [number, number],
                            )?.[1] || 0,
                    };
                },
            );

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
        .attr("width", 140)
        .attr("height", 110)
        .attr("rx", 8)
        .attr("fill", "#ffffffaa")
        .attr("stroke", "#999")
        .attr("class", "legend-clip-rect");

    legendLayer
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 140)
        .attr("height", 130)
        .attr("rx", 8)
        .attr("fill", "#ffffffaa")
        .attr("stroke", "#999")
        .attr("class", "legend-background");

    legendLayer
        .append("text")
        .attr("x", 10)
        .attr("y", 25)
        .attr("fill", "#333")
        .attr("font-size", 18)
        .attr("class", "legend-text")
        .text(name);

    const innerLegend = legendLayer
        .append("g")
        .attr("class", "inner-legend")
        .attr("clip-path", `url(#${clipId})`)
        .attr("transform", `translate(0, -10)`);

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
    ) => void,
    onMouseover: (event: any) => void,
    onMouseout: (event: any) => void,
): d3.ScaleLinear<number, number, never> {
    const radiusScale = d3.scaleLinear().domain([0, maxValue]).range([0, 30]);

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
            .attr("cy", (d) => 50 + 30 * 2 - radiusScale(d))
            .attr("r", (d) => radiusScale(d))
            .attr("fill", "#ff9800")
            .attr("opacity", 0.7)
            .attr("stroke", "#e65100")
            .attr("stroke-width", 1);

        legendLayer
            .selectAll(".legend-label")
            .data(legendValues)
            .enter()
            .append("text")
            .attr("class", "legend-label")
            .attr("x", 10)
            .attr("y", (d) => 50 + 30 * 2 - radiusScale(d) * 2 + 5)
            .attr("fill", "#333")
            .attr("font-size", 12)
            .text((d) => (d / 1000).toFixed(0) + "000");

        legendLayer
            .selectAll(".legend-tick")
            .data(legendValues)
            .enter()
            .append("line")
            .attr("class", "legend-tick")
            .attr("x1", 100)
            .attr("y1", (d) => 50 + 30 * 2 - radiusScale(d) * 2)
            .attr("x2", 60)
            .attr("y2", (d) => 50 + 30 * 2 - radiusScale(d) * 2)
            .attr("stroke", "#333")
            .attr("stroke-width", 1);

        applyZoom(legendLayer, zoom);
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
    circles
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", 0)
        .attr("fill", "#ff9800")
        .attr("opacity", 0.7)
        .attr("stroke", "#e65100")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .transition()
        .duration(animationDuration)
        .attr("r", (d) => radiusScale(d.value));

    circles
        .transition()
        .duration(animationDuration)
        .attr("r", (d) => radiusScale(d.value));

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
    ) => void,
    onMouseover: (event: any) => void,
    onMouseout: (event: any) => void,
): d3.ScaleLinear<number, number, never> {
    const continents = Object.keys(continent);

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
            const arcPoints = d3
                .range(0, 1.001, 0.05)
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
            console.log("Exiting arc:", d3.select(this).datum());
            const length = (this as SVGPathElement).getTotalLength();
            return `${length}`;
        })
        .remove();

    const arrowEnter = arrowPath
        .enter()
        .append("path")
        .attr("class", "data-arrow")
        .attr("fill", "none")
        .attr("stroke", "#ff9800")
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
        .attr("stroke-width", (d) => strokeScale(d.value))
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

    const arrowheadSize = 17;

    const arrowheadEnter = arrowheads
        .enter()
        .append("path")
        .attr("class", "arrow-head data-arrow")
        .attr("fill", "#ff9800")
        .attr("stroke", "none");

    arrowheadEnter
        .merge(arrowheads)
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
            .attr("x1", 100)
            .attr("y1", (d, i) => 45 + 25 * i + (strokeScale(d) * (i - 2)) / 2)
            .attr("x2", 120)
            .attr("y2", (d, i) => 45 + 25 * i + (strokeScale(d) * (i - 2)) / 2)
            .attr("stroke", "#ff9800")
            .attr("stroke-width", (d) => strokeScale(d));

        legendLayer
            .selectAll(".legend-label")
            .data(legendValues)
            .enter()
            .append("text")
            .attr("class", "legend-label")
            .attr("x", 10)
            .attr("y", (d, i) => 45 + 25 * i + (strokeScale(d) * (i - 2)) / 2)
            .attr("fill", "#333")
            .attr("font-size", 12)
            .text((d) => (d / 1000).toFixed(0) + "000");

        applyZoom(legendLayer, zoom);
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
): d3.ScaleLinear<string, string, never> {
    const colorScale = d3
        .scaleLinear<string>()
        .domain([minValue, 0, maxValue])
        .range(["#ff0000", "#ffffff", "#0011ff"]);

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
            return point ? colorScale(point.value) : "#d3d3d3";
        });
    return colorScale;
}
