import { config } from "@/metadata/configurations";

interface LegendProps {
    legendLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    name: string;
}

export function createLegend({
    legendLayer,
    name = "Légende :",
}: LegendProps): d3.Selection<SVGGElement, unknown, null, undefined> {
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
