/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { type JSX, useEffect, useRef } from "react";

import * as d3 from "d3";
import * as topojson from "topojson-client";

import { useGlobal } from "./globalProvider";

export function WorldMap(): JSX.Element {
    const svgRef = useRef<SVGSVGElement>(null);
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
                .scale(200)
                .translate([width / 2, height / 2]);

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

                // Create SVG
                const mapSvg = d3
                    .select(svg)
                    .attr("width", width)
                    .attr("height", height)
                    .attr("viewBox", `0 0 ${width} ${height}`)
                    .attr("style", "max-width: 100%; height: auto;");

                // Draw background
                mapSvg
                    .append("rect")
                    .attr("width", width)
                    .attr("height", height)
                    .attr("fill", "#e6f2ff");

                // Draw countries
                mapSvg
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
                        // France has id 250 in the world topology
                        console.log(d);
                        return d.properties.name === "France"
                            ? "#ff6b6b"
                            : "#d3d3d3";
                    })
                    .attr("stroke", "#999")
                    .attr("stroke-width", 0.5)
                    .style("cursor", "pointer")
                    .on("mouseover", (event: any) => {
                        d3.select(event.currentTarget)
                            .attr("stroke-width", 1)
                            .attr("opacity", 0.8);
                    })
                    .on("mouseout", (event: any) => {
                        d3.select(event.currentTarget)
                            .attr("stroke-width", 0.5)
                            .attr("opacity", 1);
                    });

                // Draw ocean borders
                mapSvg
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
                    .attr("d", pathGenerator as any);
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

    return (
        <div className="world-map-container">
            <svg ref={svgRef} />
        </div>
    );
}
