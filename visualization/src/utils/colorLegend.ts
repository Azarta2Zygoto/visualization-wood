/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend
import * as d3 from "d3";

interface LegendOptions {
    title?: string;
    tickSize?: number;
    width?: number;
    height?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    ticks?: number;
    tickFormat?: string;
}

export function Legend(
    color: any,
    {
        title,
        tickSize = 6,
        width = 320 + tickSize,
        height = 44,
        marginTop = 36,
        marginRight = 0 + tickSize,
        marginBottom = 16,
        marginLeft = 0,
        ticks = height / 64,
        tickFormat,
    }: LegendOptions = {},
): SVGSVGElement | null {
    function ramp(color: (t: number) => string, n = 256): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = n;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not get canvas context");
        for (let i = 0; i < n; ++i) {
            context.fillStyle = color(i / (n - 1));
            context.fillRect(0, i, 1, 1);
        }
        return canvas;
    }

    const svg = d3
        .create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("class", "color-legend")
        .style("overflow", "visible")
        .style("display", "block");

    const tickAdjust: (
        g: d3.Selection<SVGGElement, undefined, null, undefined>,
    ) => void = (g) => g.selectAll(".tick line").attr("x1", -tickSize);

    // Continuous - handle both standard and diverging scales
    const domain = color.domain();
    const domainMin = Math.min(...domain);
    const domainMax = Math.max(...domain);

    const y = d3
        .scaleLinear()
        .domain([domainMax, domainMin]) // Reversed for top-to-bottom
        .range([marginTop, height - marginBottom]);

    svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr(
            "xlink:href",
            ramp((t) =>
                color(domainMin + t * (domainMax - domainMin)),
            ).toDataURL(),
        );

    const axis = d3.axisRight(y).ticks(ticks, tickFormat).tickSize(tickSize);

    svg.append("g")
        .attr("transform", `translate(${width - marginRight},0)`)
        .call(axis)
        .call(tickAdjust)
        .call((g) => g.select(".domain").remove())
        .call((g) =>
            g
                .append("text")
                .attr("x", 0)
                .attr("y", marginTop - 10)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start")
                .attr("font-weight", "bold")
                .style("font-size", 16)
                .attr("class", "title")
                .text(title ?? null),
        );

    return svg.node();
}
