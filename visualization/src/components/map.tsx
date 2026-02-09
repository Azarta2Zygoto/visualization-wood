/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
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

import { useGlobal } from "./globalProvider";
import TooltipMap from "./tooltipMap";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const pays_english = new Set(Object.values(pays).map((country) => country.en));
const animationDuration = 800;

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
    const svgRef = useRef<SVGSVGElement>(null);
    const worldDataCache = useRef<any>(null);
    const [projectionMap, setProjectionMap] = useState<any>(null);
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
    const { windowSize } = useGlobal();

    useEffect(() => {
        console.log("Loading map with isCountryMode =", isCountryMode);
        const loadMap = async () => {
            const svg = svgRef.current;
            if (!svg) return;

            // Create projection and path
            const projection = d3
                .geoNaturalEarth1()
                .scale(310)
                .translate([windowSize.width / 2 - 10, windowSize.height / 2]);
            setProjectionMap(() => projection);

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
                    console.log("Merging countries by continent");

                    Object.keys(continent).forEach((cont) => {
                        const countriesInContinent =
                            continent[cont as keyof typeof continent];

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
                    .attr("width", windowSize.width - 20)
                    .attr("width", windowSize.width)
                    .attr("height", windowSize.height)
                    .attr(
                        "viewBox",
                        `0 0 ${windowSize.width - 20} ${windowSize.height}`,
                    );

                const mapLayer = mapSvg.append("g").attr("class", "map-layer");
                const legendLayer = mapSvg
                    .append("g")
                    .attr("class", "legend-layer");
                setLayer(mapLayer);
                setLegendLayer(legendLayer);

                const zoom = d3
                    .zoom<SVGSVGElement, unknown>()
                    .scaleExtent([0.5, 10])
                    .on("zoom", (event) => {
                        mapLayer.attr("transform", event.transform);
                    });

                mapSvg.call(zoom);

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
                    .attr("x", windowSize.width / 2 - 10)
                    .attr("y", windowSize.height / 2)
                    .attr("text-anchor", "middle")
                    .text("Error loading map data");
            }
        };

        loadMap();
    }, [isCountryMode, windowSize.height, windowSize.width]);

    // Effect 2: Filter and aggregate data using useMemo (no extra render)
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
    useEffect(() => {
        if (!layer) return;

        layer.selectAll(".country").on("click", (_: any, d: any) => {
            console.log("Country clicked:", d.properties.name);

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

    // Memoized event handlers (stable references to prevent re-attaching)
    const handleCountryMouseover = useCallback(
        (event: any) => {
            // Visual feedback
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
            const currentCountryName = event.target.__data__.properties.name;
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

    const handleCountryMouseout = useCallback((event: any) => {
        d3.select(event.currentTarget)
            .attr("stroke-width", 0.5)
            .attr("opacity", 1);
        setTooltipData((prev) => ({ ...prev, appear: false }));
    }, []);

    // Effect 3: Attach event handlers once when map loads
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const mapLayer = d3.select(svg).select<SVGGElement>(".map-layer");
        const legendLayer = d3.select(svg).select<SVGGElement>(".legend-layer");
        if (mapLayer.empty() || legendLayer.empty()) return;

        // Attach handlers (handlers are stable and read from ref)
        mapLayer
            .selectAll(".known-country")
            .on("mouseover", handleCountryMouseover)
            .on("mouseout", handleCountryMouseout);
    }, [handleCountryMouseover, handleCountryMouseout]);

    // Effect 4: Update data circles based on filtered data
    useEffect(() => {
        if (
            !lectureData ||
            Object.keys(lectureData).length === 0 ||
            !projectionMap
        )
            return;

        const svg = svgRef.current;
        if (!svg) return;

        const mapLayer = d3.select(svg).select<SVGGElement>(".map-layer");
        if (mapLayer.empty()) return;

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
        const radiusScale = d3
            .scaleLinear()
            .domain([0, maxValue])
            .range([0, 20]);

        if (legendLayer) {
            const legendRadius = radiusScale(maxValue);
            const legend = legendLayer
                .attr("transform", "translate(16, 16)")
                .attr("pointer-events", "none");

            legend.selectAll("*").remove();
            legend
                .append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 140)
                .attr("height", 60)
                .attr("rx", 8)
                .attr("fill", "#ffffffcc")
                .attr("stroke", "#999");
            legend
                .append("circle")
                .attr("cx", 24)
                .attr("cy", 30)
                .attr("r", legendRadius)
                .attr("fill", "#ff9800")
                .attr("opacity", 0.7)
                .attr("stroke", "#e65100")
                .attr("stroke-width", 1);
            legend
                .append("text")
                .attr("x", 52)
                .attr("y", 34)
                .attr("fill", "#333")
                .attr("font-size", 12)
                .text(`Max: ${Math.round(maxValue)}`);
        }

        // Bind data to circles (only countries with data)
        const circles = mapLayer
            .selectAll<
                SVGCircleElement,
                (typeof pointData)[number]
            >(".data-point")
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
    }, [lectureData, type, dataPointOnMap, projectionMap]);

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
