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
import pays from "@/data/country_extended.json";

import { useGlobal } from "./globalProvider";
import TooltipMap from "./tooltipMap";

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
}

export function WorldMap({
    allData,
    type,
    year,
    month,
    productsSelected,
    countriesSelected,
    isMultipleMode,
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
    const { windowSize } = useGlobal();

    useEffect(() => {
        const loadMap = async () => {
            const svg = svgRef.current;
            if (!svg) return;

            // Create projection and path
            const projection = d3
                .geoNaturalEarth1()
                .scale(310)
                .translate([windowSize.width / 2, windowSize.height / 2]);
            setProjectionMap(() => projection);

            const pathGenerator = d3.geoPath().projection(projection);

            // Clear any existing content
            d3.select(svg).selectAll("*").remove();

            try {
                // Fetch or use cached world topology data
                let worldData = worldDataCache.current;
                if (!worldData) {
                    const response = await fetch(
                        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
                    );
                    if (!response.ok)
                        throw new Error("Failed to load world data");
                    worldData = await response.json();
                    worldDataCache.current = worldData;
                }

                // Extract country features (topojson.feature always returns FeatureCollection)
                const countryFeatures = (
                    topojson.feature(
                        worldData,
                        worldData.objects.countries,
                    ) as any
                ).features;

                // Create SVG
                const mapSvg = d3
                    .select(svg)
                    .attr("class", "map-layer")
                    .attr("width", windowSize.width)
                    .attr("height", windowSize.height)
                    .attr(
                        "viewBox",
                        `0 0 ${windowSize.width} ${windowSize.height}`,
                    );

                const mapLayer = mapSvg.append("g").attr("class", "map-layer");

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
                    .data(countryFeatures)
                    .enter()
                    .append("path")
                    .attr("class", (d: any) => {
                        return pays_english.has(d.properties.name)
                            ? "country known-country"
                            : "country";
                    })
                    .attr("d", pathGenerator as any)
                    .attr("fill", (d: any) => {
                        return d.properties.name === "France"
                            ? "#ff6b6b"
                            : pays_english.has(d.properties.name)
                              ? "#87ceeb"
                              : "#d3d3d3";
                    })
                    .attr("stroke", "#999")
                    .attr("stroke-width", 0.5)
                    .style("cursor", (d: any) =>
                        pays_english.has(d.properties.name)
                            ? "pointer"
                            : "default",
                    );

                // Build a list of points with projected positions
                const pointData = countryFeatures
                    .map((feature: any) => {
                        const countryName = feature.properties.name;
                        if (
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
                    .attr("x", windowSize.width / 2)
                    .attr("y", windowSize.height / 2)
                    .attr("text-anchor", "middle")
                    .text("Error loading map data");
            }
        };

        loadMap();
    }, [windowSize.height, windowSize.width]);

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

    // Memoized event handlers (stable references to prevent re-attaching)
    const handleCountryMouseover = useCallback(
        (event: any) => {
            // Visual feedback
            d3.select(event.currentTarget)
                .attr("stroke-width", (d: any) => {
                    return pays_english.has(d.properties.name) ||
                        d.properties.name === "France"
                        ? 1.5
                        : 0.5;
                })
                .attr("opacity", (d: any) => {
                    return pays_english.has(d.properties.name) ||
                        d.properties.name === "France"
                        ? 0.6
                        : 1;
                });

            // Tooltip data (read from ref to get current data)
            const currentCountryName = event.target.__data__.properties.name;
            if (!lectureData[currentCountryName]) return;

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
        [lectureData, type, year, month],
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
        if (mapLayer.empty()) return;

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
