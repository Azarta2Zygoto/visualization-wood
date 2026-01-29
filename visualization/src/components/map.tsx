/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { type JSX, useEffect, useRef, useState } from "react";

import * as d3 from "d3";
import * as topojson from "topojson-client";

import pays from "@/data/country.json";

import { useGlobal } from "./globalProvider";
import TooltipMap from "./tooltipMap";

const pays_values = Object.values(pays);

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
    const [worldMapCountry, setWorldMapCountry] = useState<any>(null);
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
    const [lectureData, setLectureData] = useState<number[][]>([]);
    const { windowSize } = useGlobal();

    useEffect(() => {
        const loadMap = async () => {
            const svg = svgRef.current;
            if (!svg) return;

            // Set dimensions
            const normalWidth = 960;
            const normalHeight = 600;
            const rapport = normalWidth / normalHeight;

            const height = Math.min(
                windowSize.height,
                windowSize.width / rapport,
            );
            const width = Math.min(height * rapport, windowSize.width);

            // Create projection and path
            const projection = d3
                .geoNaturalEarth1()
                .scale(300)
                .translate([width / 2, height / 2]);
            setProjectionMap(() => projection);

            const pathGenerator = d3.geoPath().projection(projection);

            // Clear any existing content
            d3.select(svg).selectAll("*").remove();

            try {
                // Fetch world topology data
                const response = await fetch(
                    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
                );
                if (!response.ok) throw new Error("Failed to load world data");
                const worldData = await response.json();

                // Extract countries feature
                const countries = topojson.feature(
                    worldData,
                    worldData.objects.countries,
                ) as any;
                setWorldMapCountry(countries);

                // Create SVG
                const mapSvg = d3
                    .select(svg)
                    .attr("width", width)
                    .attr("height", height)
                    .attr("viewBox", `0 0 ${width} ${height}`)
                    .attr("style", "max-width: 100%; height: auto;")
                    .style("cursor", "grab");

                const mapLayer = mapSvg.append("g").attr("class", "map-layer");

                const zoom = d3
                    .zoom<SVGSVGElement, unknown>()
                    .scaleExtent([1, 8])
                    .on("zoom", (event) => {
                        mapLayer.attr("transform", event.transform);
                    })
                    .on("start", () => {
                        mapSvg.style("cursor", "grabbing");
                    })
                    .on("end", () => {
                        mapSvg.style("cursor", "grab");
                    });

                mapSvg.call(zoom as any);

                // Draw background
                mapLayer
                    .append("rect")
                    .attr("width", width)
                    .attr("height", height)
                    .attr("fill", "#e6f2ff");

                // Draw countries
                mapLayer
                    .selectAll(".country")
                    .data(
                        countries.type === "FeatureCollection"
                            ? countries.features
                            : [countries],
                    )
                    .enter()
                    .append("path")
                    .attr("class", "country")
                    .attr("d", pathGenerator as any)
                    .attr("fill", (d: any) => {
                        return d.properties.name === "France"
                            ? "#ff6b6b"
                            : pays_values.includes(d.properties.name)
                              ? "#87ceeb"
                              : "#d3d3d3";
                    })
                    .attr("data-name", (d: any) => d.properties.name)
                    .attr("stroke", "#999")
                    .attr("stroke-width", 0.5)
                    .style("cursor", (d: any) =>
                        pays_values.includes(d.properties.name)
                            ? "pointer"
                            : "default",
                    )
                    .on("mouseover", (event: any) => {
                        d3.select(event.currentTarget)
                            .attr("stroke-width", (d: any) => {
                                return pays_values.includes(
                                    d.properties.name,
                                ) || d.properties.name === "France"
                                    ? 1
                                    : 0.5;
                            })
                            .attr("opacity", (d: any) => {
                                return pays_values.includes(
                                    d.properties.name,
                                ) || d.properties.name === "France"
                                    ? 0.8
                                    : 1;
                            });
                    })
                    .on("mouseout", (event: any) => {
                        d3.select(event.currentTarget)
                            .attr("stroke-width", 0.5)
                            .attr("opacity", 1);
                    });

                // Draw ocean borders
                mapLayer
                    .append("path")
                    .datum(
                        topojson.mesh(
                            worldData,
                            worldData.objects.countries,
                            (a: any, b: any) => a !== b,
                        ),
                    )
                    .attr("fill", "none")
                    .attr("stroke", "#999")
                    .attr("stroke-width", 0.5)
                    .attr("d", pathGenerator as any)
                    .style("cursor", "pointer");
            } catch (error) {
                console.error("Error loading map:", error);
                d3.select(svg)
                    .append("text")
                    .attr("x", width / 2)
                    .attr("y", height / 2)
                    .attr("text-anchor", "middle")
                    .text("Error loading map data");
            }
        };

        loadMap();
    }, [windowSize.height, windowSize.width]);

    useEffect(() => {
        if (!allData) return;

        const newLectureData = allData[year]?.filter((entry) => {
            const productMatch =
                productsSelected.length === 0 ||
                productsSelected.includes(entry[3]);
            const monthMatch = entry[2] === month;
            return productMatch && monthMatch;
        });
        setLectureData(newLectureData || []);
        const usefulData = newLectureData?.filter((entry) => entry[1] === type);

        const updateMap = () => {
            const svg = svgRef.current;
            if (!svg || !usefulData) return;

            const mapLayer = d3.select(svg).select<SVGGElement>(".map-layer");
            console.log("Updating map with data:", mapLayer);
            if (mapLayer.empty()) return;

            // Aggregate data by country
            const dataByCountry: { [key: string]: number } = {};
            usefulData.forEach((entry: any) => {
                const countryIndex = entry[0];
                const countryName = pays[countryIndex as keyof typeof pays];
                const value = entry[4] || 0; // Assuming index 4 contains the value
                if (countryName) {
                    dataByCountry[countryName] =
                        (dataByCountry[countryName] || 0) + value;
                }
            });

            // Find max value for scaling
            const maxValue = Math.max(...usefulData.map((data) => data[4]), 1);
            const radiusScale = d3
                .scaleLinear()
                .domain([0, maxValue])
                .range([2, 20]);

            // Calculate country centroids and draw circles
            const countryFeatures =
                worldMapCountry.type === "FeatureCollection"
                    ? worldMapCountry.features
                    : [worldMapCountry];

            mapLayer
                .selectAll(".country")
                .on("mouseover", (event) => {
                    const currentCountryName =
                        event.target.__data__.properties.name;
                    if (!dataByCountry[currentCountryName]) return;
                    setTooltipData({
                        appear: true,
                        year,
                        month,
                        country: currentCountryName,
                        value: dataByCountry[currentCountryName],
                    });
                    setTooltipPosition({
                        x: event.pageX,
                        y: event.pageY,
                    });
                })
                .on("mouseout", () => {
                    setTooltipData((prev) => ({ ...prev, appear: false }));
                });

            mapLayer.selectAll(".data-point").remove();

            countryFeatures.forEach((feature: any) => {
                const countryName = feature.properties.name;
                if (dataByCountry[countryName]) {
                    // Calculate centroid using d3.geoCentroid
                    const centroid = d3.geoCentroid(feature);
                    const projectedCentroid = projectionMap(centroid);

                    if (projectedCentroid) {
                        mapLayer
                            .append("circle")
                            .attr("class", "data-point")
                            .attr("cx", projectedCentroid[0])
                            .attr("cy", projectedCentroid[1])
                            .attr("r", radiusScale(dataByCountry[countryName]))
                            .attr("fill", "#ff9800")
                            .attr("opacity", 0.7)
                            .attr("stroke", "#e65100")
                            .attr("stroke-width", 1)
                            .style("cursor", "pointer");
                    }
                }
            });
        };

        updateMap();
    }, [
        allData,
        month,
        productsSelected,
        projectionMap,
        type,
        worldMapCountry,
        year,
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
