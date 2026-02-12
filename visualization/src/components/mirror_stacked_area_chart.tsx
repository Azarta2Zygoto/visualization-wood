"use client";

import * as d3 from "d3";


export interface MirrorDataPoint {
    date: Date;
    product: string;
    type: "Importation" | "Exportation";
    value: number;
}
export default function updateMirrorStackedAreaChart(
    data: MirrorDataPoint[],
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
) {
    if (!data || data.length === 0) return;


    const width = 1200;
    const height = 500;

    const marginTop = 40;
    const marginRight = 100;
    const marginBottom = 40;
    const marginLeft = 50;

    /* =========================
       ROOT GROUP (create once)
    ========================= */

    let root = svg.select<SVGGElement>(".mirror-root");
    if (root.empty()) {
        root = svg.append("g").attr("class", "mirror-root");
    }

    /* =========================
       DATA PREP
    ========================= */

    const allDates = Array.from(d3.union(data.map(d => +d.date)))
        .map(d => new Date(d))
        .sort(d3.ascending);

    const products = Array.from(d3.union(data.map(d => d.product)));

    const completeIndex = (type: string) => {
        const filtered = data.filter(d => d.type === type);
        const index = d3.index(filtered, d => +d.date, d => d.product);

        const complete = new Map<number, Map<string, { value: number }>>();

        allDates.forEach(date => {
            const dateKey = +date;
            const dateMap = new Map<string, { value: number }>();

            products.forEach(product => {
                const value = index.get(dateKey)?.get(product)?.value ?? 0;
                dateMap.set(product, { value });
            });

            complete.set(dateKey, dateMap);
        });

        return complete;
    };

    const importIndex = completeIndex("Importation");
    const exportIndex = completeIndex("Exportation");

    const stack = d3.stack<Map<string, { value: number }>, string>()
        .keys(products)
        .value(([, D]: any, key) => D.get(key)?.value ?? 0);

    const importSeries = stack(
        Array.from(importIndex.entries()).map(([date, D]) => [new Date(date), D] as any)
    );

    const exportSeries = stack(
        Array.from(exportIndex.entries()).map(([date, D]) => [new Date(date), D] as any)
    );

    /* =========================
       SCALES
    ========================= */

    const x0 = d3.scaleUtc()
        .domain(d3.extent(allDates) as [Date, Date])
        .range([marginLeft, width - marginRight]);

    const maxImport = d3.max(importSeries, s => d3.max(s, d => d[1])) ?? 0;
    const maxExport = d3.max(exportSeries, s => d3.max(s, d => d[1])) ?? 0;
    const maxIMPEX = Math.max(maxImport, maxExport);

    const y0 = d3.scaleLinear()
        .domain([-maxIMPEX, maxIMPEX])
        .nice()
        .range([height - marginBottom, marginTop]);

    const x = x0.copy();
    const y = y0.copy();

    // Palette disponible
    const palette = d3.schemeTableau10;

    // Stockage persistant sur le svg
    let colorRegistry = svg.property("__colorRegistry");
    if (!colorRegistry) {
        colorRegistry = new Map<string, string>();
        svg.property("__colorRegistry", colorRegistry);
    }

    // Produits actuellement visibles
    const currentProducts = new Set(products);

    // Libérer les couleurs des produits disparus
    for (const key of colorRegistry.keys()) {
        if (!currentProducts.has(key)) {
            colorRegistry.delete(key);
        }
    }

    // Assigner couleur si nouveau produit
    products.forEach(product => {
        if (!colorRegistry.has(product)) {
            const usedColors = new Set(colorRegistry.values());
            const available = palette.find(c => !usedColors.has(c));
            colorRegistry.set(product, available ?? palette[0]);
        }
    });

    // Fonction couleur
    const color = (product: string) => colorRegistry.get(product)!;


    /* =========================
       CLIP PATH (create once)
    ========================= */

    let defs = svg.select<SVGGElement>("defs");
    if (defs.empty()) defs = svg.append("defs");

    let clip = defs.select<any>("#mirror-clip");
    if (clip.empty()) {
        clip = defs.append("clipPath").attr("id", "mirror-clip");
        clip.append("rect");
    }

    clip.select("rect")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom);

    /* =========================
       GROUPS (create once)
    ========================= */

    let gExport = root.select<SVGGElement>(".export-group");
    if (gExport.empty()) {
        gExport = root.append("g")
            .attr("class", "export-group")
            .attr("clip-path", "url(#mirror-clip)");
    }

    let gImport = root.select<SVGGElement>(".import-group");
    if (gImport.empty()) {
        gImport = root.append("g")
            .attr("class", "import-group")
            .attr("clip-path", "url(#mirror-clip)");
    }

    /* =========================
       TOOLTIP
    ========================= */
    let Tooltip: d3.Selection<any, any, any, any> = d3.select("body")
        .select<HTMLDivElement>(".mirror-tooltip");

    if (Tooltip.empty()) {
        Tooltip = d3.select("body")
            .append("div")
            .attr("class", "mirror-tooltip")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("padding", "6px")
            .style("border", "1px solid #999")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("opacity", 0);
    }


    /* =========================
       AREA GENERATORS
    ========================= */

    const areaExport = d3.area<any>()
        .x(d => x(d.data[0]))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveMonotoneX);

    const areaImport = d3.area<any>()
        .x(d => x(d.data[0]))
        .y0(d => y(-d[0]))
        .y1(d => y(-d[1]))
        .curve(d3.curveMonotoneX);

    /* =========================
       AXES (create once)
    ========================= */

    let yAxis = root.select<SVGGElement>(".y-axis");
    if (yAxis.empty()) {
        yAxis = root.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${marginLeft},0)`);
    }

    let xAxis = root.select<SVGGElement>(".x-axis");
    if (xAxis.empty()) {
        xAxis = root.append("g")
            .attr("class", "x-axis");
    }

    function updateAxes() {
        yAxis
            .transition()
            .duration(500)
            .call(d3.axisLeft(y))
            .call(g => g.select(".domain").remove());

        xAxis
            .attr("transform", `translate(0,${y(0)})`)
            .transition()
            .duration(500)
            .call(d3.axisBottom(x).tickSizeOuter(0));
    }

    updateAxes();

    /* =========================
       DRAW AREAS (join)
    ========================= */
    let currentTransform = d3.zoomIdentity;

    function drawAreas(group: any, series: any, area: any, type: String) {
        group.selectAll("path.myArea")
            .data(series, (d: any) => d.key)
            .join(
                (enter: any) =>
                    enter.append("path")
                        .attr("class", "myArea")
                        .attr("fill", (d: any) => color(d.key))
                        .style("opacity", 0)
                        .attr("d", area)
                        .call((e: any) => e.transition().duration(800).style("opacity", 1)),
                (update: any) =>
                    update.call((u: any) =>
                        u.transition().duration(800).attr("d", area)
                    ),
                (exit: any) =>
                    exit.call((x: any) =>
                        x.transition().duration(400).style("opacity", 0).remove()
                    )
            ).on("mouseover", function (this: any) {
                Tooltip.style("opacity", 1);
                d3.selectAll(".myArea").style("opacity", 0.2);
                d3.select(this).style("stroke", "black").style("opacity", 1);
            })
            .on("mousemove", function (event: any, d: any) {
                const mouseX = d3.pointer(event, svg.node())[0];
                const zx = currentTransform.rescaleX(x0);
                const mouseDate = zx.invert(mouseX);

                const closest = d.reduce((a: any, b: any) =>
                    Math.abs(b.data[0] - +mouseDate) < Math.abs(a.data[0] - +mouseDate) ? b : a
                );

                const value = closest[1] - closest[0];

                Tooltip
                    .html(`
              <strong>${type} : </strong>${d.key}<br>
              <strong>Date :</strong> ${d3.timeFormat("%Y-%m-%d")(closest.data[0])}<br>
              <strong>Valeur :</strong> ${value}
            `)
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 10}px`);
            })
            .on("mouseleave", function () {
                Tooltip.style("opacity", 0);
                d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none");
            });
    }

    drawAreas(gExport, exportSeries, areaExport, "Export");
    drawAreas(gImport, importSeries, areaImport, "Import");

    /* =========================
       LEGEND (join)
    ========================= */

    let legend = root.select<SVGGElement>(".legend");
    if (legend.empty()) {
        legend = root.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - marginRight + 10}, ${marginTop})`);
    }

    legend.selectAll("g")
        .data(products)
        .join(
            enter => {
                const g = enter.append("g");
                g.append("rect")
                    .attr("width", 15)
                    .attr("height", 15);
                g.append("text")
                    .attr("x", 20)
                    .attr("y", 12);
                return g;
            }
        )
        .attr("transform", (_, i) => `translate(0, ${i * 25})`)
        .call(g => {
            g.select("rect").attr("fill", d => color(d));
            g.select("text").text(d => d);
        });

    /* =========================
       ZOOM (attach once)
    ========================= */


    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 10])
        .extent([
            [marginLeft, marginTop],
            [width - marginRight, height - marginBottom]
        ])
        .translateExtent([
            [marginLeft, marginTop],
            [width - marginRight, height - marginBottom]
        ])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            const zx = event.transform.rescaleX(x0);
            const zy = event.transform.rescaleY(y0);

            x.domain(zx.domain());
            y.domain(zy.domain());

            gExport.selectAll("path").attr("d", areaExport as any);
            gImport.selectAll("path").attr("d", areaImport as any);

            yAxis
                .call(d3.axisLeft(y))
                .call(g => g.select(".domain").remove());

            xAxis
                .attr("transform", `translate(0,${y(0)})`)
                .call(d3.axisBottom(x).tickSizeOuter(0));

        });

    svg.call(zoom);

    // Vérifier si un zoom est déjà appliqué
    const hasZoom = svg.property("__zoom") !== undefined;
    if (!hasZoom) {
        (svg as any).call(zoom);
    } else {
        svg.property("__zoom", null);
        (svg as any).call(zoom);
    }

}
