/* eslint-disable @typescript-eslint/no-explicit-any */
import * as d3 from "d3";

import { config } from "@/metadata/mapConfig";
import { calculateArrowHead } from "@/utils/arrow";
import { clampedScale } from "@/utils/function";

interface ApplyZoomOnElementProps {
    mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    legendLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    radiusScale: d3.ScaleLinear<number, number>;
    zoomScale: number;
    isStatic?: boolean;
    isCountryMode?: boolean;
    isGlobe?: boolean;
}

export function applyZoomOnElement({
    mapLayer,
    legendLayer,
    radiusScale,
    zoomScale,
    isStatic = false,
    isCountryMode = true,
    isGlobe = false,
}: ApplyZoomOnElementProps): void {
    mapLayer
        .selectAll(".country")
        .attr("stroke-width", config.mapStrokeWidth / zoomScale ** 0.5);

    // Keep data points at constant visual size when isStatic
    const effectiveZoom = isStatic ? (isGlobe ? 1 : zoomScale) : 1;
    const legendZoom = isStatic ? 1 : zoomScale;

    console.log(
        "Applying zoom with effectiveZoom:",
        effectiveZoom,
        "legendZoom:",
        legendZoom,
    );

    mapLayer
        .selectAll<SVGCircleElement, any>(".data-point")
        .attr("r", (d) => radiusScale(d.value) / effectiveZoom);
    mapLayer
        .selectAll<SVGLineElement, any>(".data-arrow")
        .attr("stroke-width", (d) => radiusScale(d.value) / effectiveZoom);

    const arrowHeadSelection = mapLayer.selectAll<SVGPathElement, any>(
        ".arrow-head",
    );

    const max = d3.max(arrowHeadSelection.data(), (d) => d.value) || 1;

    arrowHeadSelection.attr("d", (d) =>
        calculateArrowHead(d, config.arrowHeadSize / effectiveZoom, max),
    );

    const legendCircleX = Math.max(
        config.legendCircleBaseX +
            config.legendCircleXFactor * (legendZoom - 1),
        config.legendCircleBaseX,
    );
    legendLayer
        .selectAll<SVGCircleElement, number>(".legend-circle")
        .attr("r", (d) => radiusScale(d) * legendZoom)
        .attr("cy", (d) => config.legendYposition - radiusScale(d) * legendZoom)
        .attr("cx", legendCircleX);

    legendLayer
        .selectAll<SVGLineElement, number>(".legend-tick")
        .attr(
            "y1",
            (d) => config.legendYposition - radiusScale(d) * legendZoom * 2,
        )
        .attr(
            "y2",
            (d) => config.legendYposition - radiusScale(d) * legendZoom * 2,
        )
        .attr("x1", legendCircleX);

    const labelY = isCountryMode
        ? (d: number) =>
              config.legendYposition -
              radiusScale(d) * legendZoom * 2 +
              config.legendLabelOffset
        : (d: number, i: number) =>
              config.legendLineBaseY +
              config.legendLineSpacing * i +
              (radiusScale(d) * legendZoom * (i - 2)) / 2;
    legendLayer
        .selectAll<SVGTextElement, number>(".legend-label")
        .attr("y", labelY);
    legendLayer
        .selectAll<SVGLineElement, number>(".legend-line")
        .attr(
            "y1",
            (d, i) =>
                config.legendLineBaseY +
                config.legendLineSpacing * i +
                (radiusScale(d) * legendZoom * (i - 2)) / 2,
        )
        .attr(
            "y2",
            (d, i) =>
                config.legendLineBaseY +
                config.legendLineSpacing * i +
                (radiusScale(d) * legendZoom * (i - 2)) / 2,
        )
        .attr("stroke-width", (d) => radiusScale(d) * legendZoom);

    const exp = isCountryMode
        ? config.countryModeExponent
        : config.continentModeExponent;
    const rectWidth = clampedScale(
        config.legendWidth,
        config.legendMaxWidth,
        legendZoom,
        exp,
    );
    const rectHeight = clampedScale(
        config.legendHeight,
        config.legendMaxHeight,
        legendZoom,
        exp,
    );

    const parentGroup = legendLayer.select<SVGGElement>(function () {
        return (this as SVGGElement).parentNode as SVGGElement;
    });
    parentGroup
        .selectAll<SVGRectElement, unknown>(
            ".legend-background, .legend-clip-rect",
        )
        .attr("width", rectWidth)
        .attr("height", rectHeight)
        .attr("x", 0)
        .attr("y", config.legendHeight - rectHeight);

    parentGroup
        .selectAll<SVGTextElement, unknown>(".legend-text")
        .attr("x", 10)
        .attr(
            "y",
            -rectHeight + config.legendHeight + config.legendLineSpacing,
        );
}
