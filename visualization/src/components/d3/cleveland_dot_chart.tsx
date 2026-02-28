/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useTranslations } from "next-intl";
import { type JSX, useEffect, useRef } from "react";

import * as d3 from "d3";

import products from "@/data/products.json";

interface ClevellandDotChartData {
    productIndex: number;
    exportValue: number;
    importValue: number;
}

interface ClevellandDotChartProps {
    data: ClevellandDotChartData[];
    width?: number;
    height?: number;
}

export default function ClevellandDotChart({
    data,
    width = 280,
    height = 250,
}: ClevellandDotChartProps): JSX.Element {
    const svgRef = useRef<SVGSVGElement>(null);
    const initRef = useRef(false);
    const t = useTranslations("Tooltip");
    const productTrads = useTranslations("Produits");

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        // Initialize SVG structure once
        if (!initRef.current) {
            const svg = d3.select(svgRef.current);
            svg.append("g").attr("class", "main-cleveland");
            initRef.current = true;
        }

        // Prepare data with product names
        const chartData = data
            .filter(
                (d) =>
                    d.exportValue >= 0 &&
                    d.importValue >= 0 &&
                    (d.exportValue > 0 || d.importValue > 0),
            )
            .map((d) => ({
                ...d,
                productName: products[
                    d.productIndex.toString() as keyof typeof products
                ]?.name
                    ? productTrads(
                          products[
                              d.productIndex.toString() as keyof typeof products
                          ].name,
                      )
                    : t("default-product", {
                          product: d.productIndex,
                      }),
            }))
            .sort((a, b) => {
                // Sort by max of export and import, descending
                const maxA = Math.max(a.exportValue, a.importValue);
                const maxB = Math.max(b.exportValue, b.importValue);
                return maxB - maxA;
            })
            .slice(0, 6); // Limit to top 6 products for visibility

        if (chartData.length === 0) return;

        //graphique
        let margin = { top: 5, right: 10, bottom: 30, left: 80 };
        const legend_height = 10;
        const font_size_name = 8;
        const font_size = 10;

        // fonction pour optimiser la margin.left en fonction de la largeur des labels, pour éviter d'avoir une margin trop grande si les labels sont courts
        const optimizeMarginLeft = (): {
            top: number;
            right: number;
            bottom: number;
            left: number;
        } => {
            const svg = d3.select(svgRef.current);
            const tempG = svg.append("g");

            // Créer les labels temporaires
            const tempLabels = tempG
                .selectAll("text.cleveland-label")
                .data(chartData)
                .enter()
                .append("text")
                .attr("x", 0)
                .attr("y", 0)
                .attr("font-size", `${font_size_name}px`)
                .text((d) => d.productName);

            // Appliquer le wrap avec la marge courante
            wrapText(tempLabels, margin.left - 10);

            // Mesurer la largeur réelle de chaque label
            const labelWidths = tempLabels
                .nodes()
                .map((node) => node.getBBox().width);
            const maxLabelWidth = Math.max(...labelWidths);

            // Supprimer le groupe temporaire
            tempG.remove();

            // Si la largeur max < (margin.left - 15), réduire margin.left
            const minRequiredMargin = maxLabelWidth + 15;
            if (minRequiredMargin < margin.left - 15) {
                margin.left = Math.ceil(minRequiredMargin);
            }

            return margin;
        };

        margin = optimizeMarginLeft();
        const chartWidth = width - margin.left - margin.right;

        // Groupe temporaire pour mesurer le texte (avec margin.left optimisée)
        // C'est sans doute redondant avec la fonction optimizeMarginLeft mais ça permet de s'assurer que les labels sont bien positionnés en fonction de la margin.left optimisée
        const svg = d3.select(svgRef.current);
        const tempG = svg.append("g");

        // Créer les labels temporaires
        const tempLabels = tempG
            .selectAll("text.cleveland-label")
            .data(chartData)
            .enter()
            .append("text")
            .attr("x", 0)
            .attr("y", 0)
            .attr("font-size", `${font_size_name}px`)
            .text((d) => d.productName);

        // Appliquer le wrap avec la margin.left optimisée
        wrapText(tempLabels, margin.left - 10);

        // Calculer la hauteur réelle de chaque label
        const labelHeights = tempLabels
            .nodes()
            .map((node) => node.getBBox().height + 4);

        // Supprimer le groupe temporaire
        tempG.remove();
        const yPositions: number[] = [];
        let cumulative = 0;
        for (const h of labelHeights) {
            yPositions.push(cumulative);
            cumulative += h;
        }
        const chartHeight = cumulative;
        const dynamicHeight =
            chartHeight + margin.top + margin.bottom + legend_height;

        // Update SVG dimensions
        svg.attr("width", width).attr("height", dynamicHeight);

        const g = svg
            .select("g.main-cleveland")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // On nettoie tout avant de redessiner, on pourrait faire une transition mais flemme pour le moment
        g.selectAll("g.grid").remove();
        g.selectAll("g.x-axis").remove();
        g.selectAll("g.y-axis").remove();
        g.selectAll("g.labels").remove();
        g.selectAll("g.legend").remove();

        // Find max value for x-axis
        const maxValue = Math.max(
            ...chartData.flatMap((d) => [d.exportValue, d.importValue]),
        );

        // Scales
        const x = d3
            .scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([0, chartWidth]);

        const y = d3
            .scaleBand()
            .domain(chartData.map((_, i) => i.toString()))
            .range([0, chartHeight])
            .padding(0.8);
        //pour ajuster la position des points en fonction de la hauteur réelle des labels
        const getY = (i: number) => yPositions[i] + labelHeights[i] / 2;

        // Lines connecting export and import
        g.selectAll("line")
            .data(chartData, (d: any) => d.productIndex)
            .join(
                (enter) =>
                    enter
                        .append("line")
                        .attr("x1", (d) => x(d.exportValue))
                        .attr("x2", (d) => x(d.importValue))
                        .attr("y1", (_, i) => getY(i))
                        .attr("y2", (_, i) => getY(i))
                        .attr("stroke", "#999")
                        .attr("stroke-width", 1)
                        .attr("opacity", 0.8),
                (update) =>
                    update
                        .transition()
                        .duration(600)
                        .attr("x1", (d) => x(d.exportValue))
                        .attr("x2", (d) => x(d.importValue))
                        .attr("y1", (_, i) => getY(i))
                        .attr("y2", (_, i) => getY(i)),
                (exit) => exit.remove(),
            );

        // Export circles
        g.selectAll("circle.export")
            .data(chartData, (d: any) => `export-${d.productIndex}`)
            .join(
                (enter) =>
                    enter
                        .append("circle")
                        .attr("class", "export")
                        .attr("cx", (d) => x(d.exportValue))
                        .attr("cy", (_, i) => getY(i))
                        .attr("r", 4)
                        .attr("fill", "#e74c3c")
                        .attr("opacity", 0.8),
                (update) =>
                    update
                        .transition()
                        .duration(600)
                        .attr("cx", (d) => x(d.exportValue))
                        .attr("cy", (_, i) => getY(i)),
                (exit) => exit.remove(),
            );

        // Import circles
        g.selectAll("circle.import")
            .data(chartData, (d: any) => `import-${d.productIndex}`)
            .join(
                (enter) =>
                    enter
                        .append("circle")
                        .attr("class", "import")
                        .attr("cx", (d) => x(d.importValue))
                        .attr("cy", (_, i) => getY(i))
                        .attr("r", 4)
                        .attr("fill", "#3498db")
                        .attr("opacity", 0.8), //on peut pas animer car ya des rappel sur l'update ce qui cut le transition
                (update) =>
                    update
                        .transition()
                        .duration(600)
                        .attr("cx", (d) => x(d.importValue))
                        .attr("cy", (_, i) => getY(i)),
                (exit) => exit.remove(),
            );

        g.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(
                d3
                    .axisBottom(x)
                    .ticks(3)
                    .tickSize(-chartHeight)
                    .tickFormat(() => ""),
            )
            .call((g) => g.select(".domain").remove()) // enlève la ligne pleine
            .selectAll(".tick line")
            .attr("stroke", "var(--fg")
            .attr("stroke-dasharray", "3,3");
        // X-axis
        const xAxisGroup = g
            .append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(
                d3
                    .axisBottom(x)
                    .ticks(3)
                    .tickFormat((d) => {
                        const val = (d as number) * 1000;
                        if (val >= 1000000000)
                            return `${(val / 1000000000).toFixed(0)} Md€`;
                        if (val >= 1000000)
                            return `${(val / 1000000).toFixed(0)} M€`;
                        if (val >= 1000) return `${(val / 1000).toFixed(0)} K€`;
                        return val.toFixed(0);
                    }),
            );

        xAxisGroup.style("font-size", `${font_size}px`);
        xAxisGroup.selectAll("text").style("font-size", `${font_size}px`);

        // Y-axis quasi pas utilisé
        const yAxisGroup = g
            .append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(y).tickFormat(() => ""));
        yAxisGroup.style("font-size", `${font_size}px`);
        yAxisGroup.selectAll("path").style("stroke", "none");
        yAxisGroup.selectAll("line").style("stroke", "none");

        // Nom des produits à gauche des points
        const labelsGroup = g.append("g").attr("class", "labels");
        const labels = labelsGroup
            .selectAll("text.product-label")
            .data(chartData)
            .enter()
            .append("text")
            .attr("class", "product-label")
            .attr("x", -8)
            .attr("y", (d, i) => {
                const yVal = yPositions[i] + 8;
                return yVal;
            })
            .attr("text-anchor", "end")
            .attr("font-size", `${font_size_name}px`)
            .attr("fill", "var(--fg)")
            .attr("opacity", 0.8)
            .text((d) => d.productName);

        // Wrap text pour chaque label (limite de largeur = margin.left - 10)
        wrapText(labels, margin.left - 10);

        // Add tooltips
        labels.append("title").text((d) => d.productName);

        // Legend
        const legendY = chartHeight + 30;
        const legendGroup = g.append("g").attr("class", "legend");

        legendGroup
            .append("circle")
            .attr("cx", 0)
            .attr("cy", legendY)
            .attr("r", 3)
            .attr("fill", "#e74c3c");
        legendGroup
            .append("text")
            .attr("x", 8)
            .attr("y", legendY + 3)
            .attr("font-size", `${font_size}px`)
            .attr("fill", "var(--fg)")
            .text("Export");

        legendGroup
            .append("circle")
            .attr("cx", 80)
            .attr("cy", legendY)
            .attr("r", 3)
            .attr("fill", "#3498db");
        legendGroup
            .append("text")
            .attr("x", 88)
            .attr("y", legendY + 3)
            .attr("font-size", `${font_size}px`)
            .attr("fill", "var(--fg)")
            .text("Import");
    }, [data, width, height]);

    return (
        <div className="cleveland-chart-wrapper">
            <svg
                ref={svgRef}
                style={{ display: "block" }}
            />
        </div>
    );
}

function wrapText(
    // on met le texte sur plusieurs lignes si il dépasse une certaine largeur
    textSelection: any,
    width: number,
) {
    textSelection.each(function (this: SVGTextElement) {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.1; // em
        const y = text.attr("y");
        const dy = 0;

        let tspan = text
            .text(null)
            .append("tspan")
            .attr("x", text.attr("x"))
            .attr("y", y)
            .attr("dy", dy + "em");

        while ((word = words.pop())) {
            line.push(word);
            tspan.text(line.join(" "));
            if ((tspan.node()?.getComputedTextLength() || 0) > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text
                    .append("tspan")
                    .attr("x", text.attr("x"))
                    .attr("y", y)
                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                    .text(word);
            }
        }
    });
}
