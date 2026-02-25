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
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    globalAllDates: Date[],
    events: any[],//la liste des évènement qui a été filtré, on a ajouté la date parsé, la catégorie, et l'iconid associé
    map_icons: Record<string, any>
) {
    if (!data || data.length === 0) return;


    const width = 1200;
    const height = 500;
    const marginTop = 40;
    const marginRight = 100;
    const marginBottom = 40;
    const marginLeft = 50;
    const iconSize = 30; // taille d'affichage des icones
    // Constante pour le wrapping du texte de la légende basée sur la largeur du conteneur
    const LEGEND_MAX_CHARS_PER_LINE = Math.max(10, Math.floor((marginRight) / 2));

    /* =========================
       ROOT GROUP (create once)
    ========================= */

    let root = svg.select<SVGGElement>(".mirror-root");
    if (root.empty()) {
        root = svg.append("g").attr("class", "mirror-root");
    }

    const allDates = globalAllDates;
    //on trie les produits pour avoir toujours le même ordre 
    const products = Array.from(
        d3.union(data.map(d => d.product))
    ).sort(d3.ascending);
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
            if (available) {//si on trouve une couleur disponible on l'affecte 
                colorRegistry.set(product, available);
            } else {
                // Compter les occurrences
                const counts = new Map<string, number>();

                palette.forEach(color => counts.set(color, 0));

                for (const color of colorRegistry.values()) {
                    counts.set(color, (counts.get(color) ?? 0) + 1);
                }

                // Trouver la couleur la moins utilisée
                const leastUsed = palette.reduce((minColor, color) => {
                    return (counts.get(color)! < counts.get(minColor)!)
                        ? color
                        : minColor;
                });
                //on attribue la couleur la moins utilisé 
                colorRegistry.set(product, leastUsed);
            }
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
    let plotGroup = root.select<SVGGElement>(".plot-group");
    if (plotGroup.empty()) {
        plotGroup = root.append("g").attr("class", "plot-group").attr("width", width)
            .attr("height", height).attr("clip-path", "url(#mirror-clip)");
    }

    let gExport = plotGroup.select<SVGGElement>(".export-group");;
    if (gExport.empty()) {
        gExport = plotGroup.append("g").attr("class", "export-group");
    }

    let gImport = plotGroup.select<SVGGElement>(".import-group");
    if (gImport.empty()) {
        gImport = plotGroup.append("g").attr("class", "import-group");
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
            .style("background", "var(--bg)")
            .style("padding", "8px")
            .style("border", "1px solid #999")
            .style("border-radius", "6px")
            .style("font-size", "12px")
            .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("z-index", 9999)
            .style("max-width", "250px")          // largeur max
            .style("white-space", "normal")      // permet le retour à la ligne
            .style("overflow-wrap", "break-word"); // coupe les mots trop longs
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
    let yAxisLabels = root.select<SVGGElement>(".y-axis-labels");
    if (yAxisLabels.empty()) {
        yAxisLabels = root.append("g")
            .attr("class", "y-axis-labels")
            .attr("transform", `translate(${marginLeft - 25},0)`);
    }

    // Sélection ou création de l'axe X à l'intérieur de plotGroup pour avoir le clip
    let xAxis = plotGroup.select<SVGGElement>(".x-axis");
    if (xAxis.empty()) {
        xAxis = plotGroup.append("g")
            .attr("class", "x-axis")
            // placer initialement à y=0 ou sur l’axe 0
            .attr("transform", `translate(0,${y(0)})`);
    }
    function updateAxes() {
        yAxis
            .transition()
            .duration(500)
            .call(d3.axisLeft(y));

        xAxis
            .attr("transform", `translate(0,${y(0)})`)
            .transition()
            .duration(500)
            .call(d3.axisBottom(x).tickSizeOuter(0));
        // EXPORT (haut)
        yAxisLabels.selectAll(".label-export")
            .data([null])
            .join("text")
            .attr("class", "label-export")
            .attr("x", 0)
            .attr("y", marginTop - 20)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .style("fill", "#444")
            .text("Export");

        // IMPORT (bas)
        yAxisLabels.selectAll(".label-import")
            .data([null])
            .join("text")
            .attr("class", "label-import")
            .attr("x", 0)
            .attr("y", height - marginBottom + 30)
            .attr("text-anchor", "middle")
            .style("font-weight", "600")
            .style("fill", "#444")
            .text("Import");
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
                (enter: any) => {
                    return enter.append("path")
                        .attr("class", "myArea")
                        .attr("fill", (d: any) => {
                            return color(d.key);
                        })
                        .style("opacity", 0)
                        .attr("d", area)
                        .call((e: any) =>
                            e.transition().duration(800).style("opacity", 1)
                        );
                },

                (update: any) => {
                    return update.call((u: any) =>
                        u.transition().duration(800).attr("d", area)
                    );
                },

                (exit: any) => {
                    return exit.call((x: any) =>
                        x.transition().duration(400).style("opacity", 0).remove()
                    );
                }
            )
            .on("mouseover", function (this: any) {
                Tooltip.style("opacity", 1);
                d3.selectAll(".myArea").style("opacity", 1);
                d3.select(this).style("stroke", "black").style("opacity", 0.45);
            })
            .on("mousemove", function (event: any, d: any) {
                const mouseX = d3.pointer(event, svg.node())[0];
                const zx = currentTransform.rescaleX(x0);
                const mouseDate = zx.invert(mouseX);

                const closest = d.reduce((a: any, b: any) =>
                    Math.abs(b.data[0] - +mouseDate) < Math.abs(a.data[0] - +mouseDate) ? b : a
                );

                const value = closest[1] - closest[0];

                Tooltip.style("opacity", 0.8)
                    .html(`
              <strong>${d.key}</strong><br>
              Type : ${type}<br>
              Valeur : ${d3.format(",.0f")(value).replace(/,/g, " ")} k€<br>
              Date : ${d3.timeFormat("%Y-%m-%d")(closest.data[0])}
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
       LEGEND (join with wrapping)
    ========================= */

    let legend = root.select<SVGGElement>(".legend");
    if (legend.empty()) {
        legend = root
            .append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - marginRight + 10}, ${marginTop})`);
    }

    legend
        .selectAll("g")
        .data(products, (d: any) => d)
        .join(
            (enter) => {
                const gEnter = enter
                    .append("g")
                    .attr("transform", (d, i) => {
                        let yOffset = 0;
                        for (let j = 0; j < i; j++) {
                            const lineCount = wrapText(products[j], LEGEND_MAX_CHARS_PER_LINE).length;
                            yOffset += Math.max(lineCount * 16 + 8, 25);
                        }
                        return `translate(0,${yOffset})`;
                    });

                // Créer le texte et calculer sa hauteur
                const textElement = gEnter
                    .append("text")
                    .attr("x", 20)
                    .attr("y", 0)
                    .style("font-size", "12px")
                    .style("line-height", "16px");

                textElement.selectAll("tspan").remove();
                textElement
                    .selectAll("tspan")
                    .data((d: any) => wrapText(d, LEGEND_MAX_CHARS_PER_LINE))
                    .enter()
                    .append("tspan")
                    .attr("x", 20)
                    .attr("dy", (d, i) => i === 0 ? 0 : "16px")
                    .text((d: string) => d);

                // Ajouter le rectangle après le texte
                const rect = gEnter
                    .insert("rect", "text")
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("fill", (d) => color(d));

                // Positionner le rect au centre vertically
                rect.attr("y", (d: any) => {
                    const lineCount = wrapText(d, LEGEND_MAX_CHARS_PER_LINE).length;
                    const textHeight = lineCount == 1 ? -11 : lineCount == 2 ? -3 : 5; // ajustement pour une ligne
                    return textHeight;
                });

                return gEnter;
            },
            (update) =>
                update.call((update) => {
                    update
                        .transition()
                        .duration(500)
                        .attr("transform", (d, i) => {
                            let yOffset = 0;
                            for (let j = 0; j < i; j++) {
                                const lineCount = wrapText(products[j], LEGEND_MAX_CHARS_PER_LINE).length;
                                yOffset += Math.max(lineCount * 16 + 8, 25);
                            }
                            return `translate(0,${yOffset})`;
                        });

                    // Mettre à jour le texte
                    update.select("text").selectAll("tspan").remove();
                    update
                        .select("text")
                        .selectAll("tspan")
                        .data((d: any) => wrapText(d, LEGEND_MAX_CHARS_PER_LINE))
                        .enter()
                        .append("tspan")
                        .attr("x", 20)
                        .attr("dy", (d, i) => i === 0 ? 0 : "16px")
                        .text((d: string) => d);

                    // Mettre à jour le rect
                    update
                        .select("rect")
                        .attr("y", (d: any) => {
                            const lineCount = wrapText(d, LEGEND_MAX_CHARS_PER_LINE).length;
                            const textHeight = lineCount == 1 ? -11 : lineCount == 2 ? -3 : 5; // ajustement pour une ligne
                            return textHeight;
                        });
                }),
            (exit) =>
                exit.call((exit) =>
                    exit.transition().duration(500).attr("opacity", 0).remove(),
                ),
        );

    /* =========================
   ICONS
    ========================= */

    Object.entries(map_icons).forEach(([category, icon]) => {
        const id = `icon-${category.toLowerCase().replace(/\s+/g, "-")}`;
        let iconDef = defs.select<SVGSVGElement>(`#${id}`);
        if (iconDef.empty()) {
            iconDef = defs.append("svg")
                .attr("id", id)
                .attr("viewBox", icon.viewBox)
                .attr("width", icon.viewBox.split(" ")[2])
                .attr("height", icon.viewBox.split(" ")[3]);

            iconDef.append("path")
                .attr("d", icon.path)
                .attr("fill", icon.fill)
                .attr("stroke", icon.stroke)
                .attr("stroke-width", icon["stroke-width"])
                .attr("stroke-linecap", icon.linecap)
                .attr("stroke-linejoin", icon.linejoin)
                .attr("transform", icon.transform || null);
        }
    });

    let iconsGroup = plotGroup.select<SVGGElement>(".icons");
    if (iconsGroup.empty()) {
        iconsGroup = plotGroup.append("g").attr("class", "icons");
    }
    iconsGroup.selectAll("use.event-icon")
        .data(events, (d: any) => d.titre_court)
        .join(
            enter => enter.append("use")
                .attr("class", "event-icon")
                .attr("xlink:href", d => `#${d.id}`)
                .attr("x", d => x0(d.dateParsed) - iconSize / 2)
                .attr("y", 0)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .style("opacity", 0)
                .call((enter) =>
                    enter.transition()
                        .duration(500)
                        .style("opacity", 1)
                        .attr("y", marginTop)
                ),

            update => update.transition().duration(500)
                .attr("x", d => x0(d.dateParsed) - iconSize / 2)
                .style("opacity", 1),

            exit => exit.transition().duration(300).attr("y", -20)
                .style("opacity", 0).remove()
        )
        .on("mouseover", (event, d: any) => {
            Tooltip.style("opacity", 1)
                .html(`
                    <strong>Titre :</strong> ${d.titre_court}<br>
                    <strong>Description :</strong> ${d.description_rapide}<br>
                    <strong>Date :</strong> ${d3.timeFormat("%Y-%m-%d")(d.dateParsed)}
                `);
        })
        .on("mousemove", (event) => {
            Tooltip.style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseleave", () => Tooltip.style("opacity", 0));

    /* =========================
       ZOOM (attach once)
    ========================= */


    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .filter((event: any) => {
            // Autoriser :
            // - molette
            // - drag souris gauche
            return (
                event.type === "wheel" ||
                event.type === "mousedown" ||
                event.type === "mousemove"
            );
        })
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
            iconsGroup.selectAll(".event-icon")
                .attr("x", (d: any) => zx(d.dateParsed) - iconSize / 2);
            yAxis
                .call(d3.axisLeft(y));

            xAxis
                .attr("transform", `translate(0,${y(0)})`)
                .call(d3.axisBottom(x).tickSizeOuter(0));

        });


    let zoomRect = plotGroup.select<SVGRectElement>(".zoom-rect");
    if (zoomRect.empty()) {
        zoomRect = plotGroup.insert("rect", ":first-child") // derrière tous les éléments
            .attr("class", "zoom-rect")
            .attr("x", marginLeft)
            .attr("y", marginTop)
            .attr("width", width - marginLeft - marginRight)
            .attr("height", height - marginTop) // ou plus si tu veux inclure la légende
            .style("fill", "transparent")
            .style("z-index", 9)
            .style("pointer-events", "all"); // indispensable pour capter la souris
    }
    // Réinitialiser le zoom existant si nécessaire
    if (plotGroup.property("__zoom")) {
        plotGroup.property("__zoom", null);
    }
    // Attacher le zoom à ce rectangle
    plotGroup.call(zoom as any);



}

// Fonction pour diviser le texte en lignes si trop long
function wrapText(text: string, maxCharsPerLine: number): string[] {
    if (text.length <= maxCharsPerLine) {
        return [text];
    }

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;

        if (testLine.length > maxCharsPerLine && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }

        if (lines.length >= 2) break; // Max 2 lignes
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}
