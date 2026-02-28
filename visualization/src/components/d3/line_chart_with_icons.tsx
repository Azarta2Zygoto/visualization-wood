/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as d3 from "d3";

interface DataPoint {
    date: Date;
    pays?: string;
    produit?: string;
    type?: string;
    value: number;
}

export default function updateMultiLines_with_icons( //c'est la fonction pour mettre a jour de svg
    stocks: {
        symbol: string;
        type: any;
        zone: any;
        product: any;
        values: any;
    }[],
    svg_animated: d3.Selection<SVGSVGElement, unknown, null, undefined>, //svg global
    knownSymbols: Set<string>, //ensemble de symboles que on a déjà vu
    map_icons: Record<string, any> | ArrayLike<unknown>, //le mapping nom -> élément svg
    events:
        | unknown[]
        | Iterable<unknown>
        | d3.ValueFn<d3.BaseType, unknown, unknown[] | Iterable<unknown>>, //la liste des évènement qui a été filtré, on a ajouté la date parsé, la catégorie, et l'iconid associé

    { x = (d: DataPoint) => d.date, y = (d: DataPoint) => d.value } = {},
    t?: any,
) {
    const width = 1200;
    const height = 500;
    const iconSize = 30; // taille d'affichage des icones
    const margin = { top: 40, right: 100, bottom: 40, left: 50 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    // Constante pour le wrapping du texte de la légende basée sur la largeur du conteneur
    const LEGEND_MAX_CHARS_PER_LINE = Math.max(
        10,
        Math.floor(margin.right / 2),
    );

    // créer le groupe plot principal si inexistant
    let g = svg_animated.select<SVGGElement>("g.plot");
    if (g.empty()) {
        g = svg_animated
            .append("g")
            .attr("class", "plot")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    }

    // couleurs
    const palette = d3.schemeTableau10;

    // registry persistante (par exemple sur le svg)
    const colorRegistry: Map<string, string> =
        svg_animated.property("__colorRegistry") ?? new Map();

    svg_animated.property("__colorRegistry", colorRegistry);

    // Symboles actuellement visibles
    const currentSymbols = new Set(stocks.map((s) => s.symbol));

    // Supprimer ceux qui ont disparu
    for (const key of Array.from(colorRegistry.keys())) {
        if (!currentSymbols.has(key)) {
            colorRegistry.delete(key);
        }
    }

    // Compter l'utilisation des couleurs
    const counts = new Map<string, number>();
    palette.forEach((c) => counts.set(c, 0));

    for (const color of colorRegistry.values()) {
        counts.set(color, (counts.get(color) ?? 0) + 1);
    }

    // Assigner couleur aux nouveaux symboles
    for (const symbol of currentSymbols) {
        if (!colorRegistry.has(symbol)) {
            // Chercher couleur libre
            let chosen = palette.find((c) => (counts.get(c) ?? 0) === 0);

            // Sinon prendre la moins utilisée
            if (!chosen) {
                chosen = palette.reduce((min, c) =>
                    counts.get(c)! < counts.get(min)! ? c : min,
                );
            }

            colorRegistry.set(symbol, chosen);
            counts.set(chosen, counts.get(chosen)! + 1);
        }
    }

    // Fonction équivalente à l’ancienne scale
    const color = (symbol: string) => colorRegistry.get(symbol)!;

    // scales
    const xScale = d3
        .scaleTime()
        .domain([
            d3.min(stocks, (s) => d3.min(s.values, (d: any) => x(d)))!,
            d3.max(stocks, (s) => d3.max(s.values, (d: any) => x(d)))!,
        ])
        .range([0, plotWidth]);

    const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(stocks, (s) => d3.max(s.values, (d: any) => y(d)))!])
        .nice()
        .range([plotHeight, 0]);
    let xScaleZoom = xScale;
    let yScaleZoom = yScale;
    // axes
    let gX = g.select<SVGGElement>("g.xAxis");
    if (gX.empty()) {
        gX = g
            .append("g")
            .attr("class", "xAxis")
            .attr("transform", `translate(0,${plotHeight})`);
    }
    gX.transition().duration(800).call(d3.axisBottom(xScale));

    let gY = g.select<SVGGElement>("g.yAxis");
    if (gY.empty()) {
        gY = g.append("g").attr("class", "yAxis");
    }
    gY.transition().duration(800).call(d3.axisLeft(yScale));

    // Ajouter le label de l'axe Y
    let yLabel = g.select<SVGTextElement>("text.y-axis-label");
    if (yLabel.empty()) {
        yLabel = g
            .append("text")
            .attr("class", "y-axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left - 12)
            .attr("x", 0 - plotHeight / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "currentColor");
    }
    // Déterminer le label en fonction du type de données
    const firstSymbol = stocks.length > 0 ? stocks[0].symbol.toLowerCase() : "";
    const yAxisLabel = firstSymbol.includes("valeur")
        ? t("euro-value")
        : firstSymbol.includes("volume")
          ? t("ton-value")
          : t("default-value");
    yLabel.text(yAxisLabel);

    const clipId = "clip-mouse-rect"; // ou un nom unique

    // créer defs si inexistant
    let defs = svg_animated.select<SVGGElement>("defs");
    if (defs.empty()) defs = svg_animated.append("defs");

    // vérifier si le clipPath existe déjà
    let clip = defs.select<SVGClipPathElement>(`#${clipId}`);

    if (clip.empty()) {
        clip = defs.append("clipPath").attr("id", clipId);

        clip.append("rect").attr("width", plotWidth).attr("height", plotHeight);
    }

    // Pour chaque catégorie d'icône, ajouter une définition si inexistante
    Object.entries(map_icons).forEach(([category, icon]) => {
        const id = `icon-${category.toLowerCase().replace(/\s+/g, "-")}`;

        // tester si l'icône existe déjà
        let iconDef = defs.select<SVGSVGElement>(`#${id}`);

        if (iconDef.empty()) {
            iconDef = defs
                .append("svg")
                .attr("id", id)
                .attr("viewBox", icon.viewBox)
                .attr("width", icon.viewBox.split(" ")[2]) // taille par défaut
                .attr("height", icon.viewBox.split(" ")[3]);

            iconDef
                .append("path")
                .attr("d", icon.path)
                .attr("fill", icon.fill)
                .attr("stroke", icon.stroke)
                .attr("stroke-width", icon["stroke-width"])
                .attr("stroke-linecap", icon.linecap)
                .attr("stroke-linejoin", icon.linejoin)
                .attr("transform", icon.transform || null);
        }
    });

    let plotArea = g.select<SVGGElement>("g.plot-area");
    if (plotArea.empty()) {
        plotArea = g
            .append("g")
            .attr("class", "plot-area")
            .attr("clip-path", `url(#${clipId})`);
    }

    // générateur de ligne
    const lineGen = d3
        .line<any>()
        .x((d) => xScaleZoom(x(d)))
        .y((d) => yScaleZoom(y(d)));

    // -------------------------------
    // Tooltip HTML global
    let Tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> = d3
        .select("body")
        .select(".line-chart-tooltip");

    if (Tooltip.empty()) {
        Tooltip = d3
            .select("body")
            .append("div")
            .attr("class", "line-chart-tooltip")
            .style("opacity", 0);
    }

    // -------------------------------
    // JOIN des lignes avec clé symbol
    plotArea
        .selectAll(".line")
        .data(stocks, (d: any) => d.symbol)
        .join(
            (enter) =>
                enter
                    .append("path")
                    .attr("class", "line")
                    .attr("fill", "none")
                    .attr("stroke-width", 2)
                    .attr("stroke", (d) => color(d.symbol))
                    .attr("opacity", 0)
                    .attr("d", (d) => lineGen(d.values))
                    .call((enter) =>
                        enter.transition().duration(800).attr("opacity", 1),
                    ),
            (update) =>
                update.call((update) =>
                    update
                        .transition()
                        .duration(800)
                        .attr("d", (d) => lineGen(d.values))
                        .attr("stroke", (d) => color(d.symbol)),
                ),
            (exit) =>
                exit.call((exit) =>
                    exit.transition().duration(500).attr("opacity", 0).remove(),
                ),
        );

    let iconsGroup = g.select<SVGGElement>("g.icons");
    if (iconsGroup.empty()) {
        iconsGroup = g
            .append("g")
            .attr("class", "icons")
            .attr("transform", `translate(0, 0)`)
            .attr("clip-path", `url(#${clipId})`);
    }
    iconsGroup
        .selectAll("g.event-icon-group")
        .data(events, (d: any) => d.titre_court)
        .join(
            (enter) => {
                const g = enter
                    .append("g")
                    .attr("class", "event-icon-group")
                    .style("opacity", 0);

                // Rectangle invisible pour le hover
                g.append("rect")
                    .attr("class", "icon-hover-rect")
                    .attr(
                        "x",
                        (d: any) => xScaleZoom(d.dateParsed) - iconSize / 2,
                    )
                    .attr("y", 0)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("fill", "none")
                    .attr("pointer-events", "all");

                // Icône (use element)
                g.append("use")
                    .attr("class", "event-icon")
                    .attr("xlink:href", (d: any) => `#${d.id}`)
                    .attr(
                        "x",
                        (d: any) => xScaleZoom(d.dateParsed) - iconSize / 2,
                    )
                    .attr("y", 0)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .style("pointer-events", "none");

                return g.call((enter) =>
                    enter
                        .transition()
                        .duration(500)
                        .style("opacity", 1)
                        .selectAll("rect, use")
                        .attr("y", 10),
                );
            },
            (update) =>
                update
                    .transition()
                    .duration(500)
                    .style("opacity", 1)
                    .selectAll("rect.icon-hover-rect, use.event-icon")
                    .attr(
                        "x",
                        (d: any) => xScaleZoom(d.dateParsed) - iconSize / 2,
                    )
                    .attr("y", 10)
                    .attr("width", iconSize)
                    .attr("height", iconSize),
            (exit) =>
                exit.transition().duration(300).style("opacity", 0).remove(),
        )
        .each(function () {
            d3.select(this)
                .select("use.event-icon")
                .attr("xlink:href", (d: any) => `#${d.id}`);
        })
        .on("mouseover", function (_, d: any) {
            Tooltip.style("opacity", 1).html(`
            <strong>${t("title")}</strong> ${d.titre_court}<br>
            <strong>${t("description")}</strong> ${d.description_rapide}<br>
            <strong>${t("date")}</strong> ${d3.timeFormat("%Y-%m-%d")(d.dateParsed)}
        `);
        })
        .on("mousemove", function (event) {
            Tooltip.style("left", `${event.pageX + 12}px`).style(
                "top",
                `${event.pageY - 40}px`,
            );
        })
        .on("mouseleave", function () {
            Tooltip.style("opacity", 0);
        });
    // -------------------------------
    // Légende
    let legend = svg_animated.select<SVGGElement>("g.legend");
    if (legend.empty()) {
        legend = svg_animated
            .append("g")
            .attr("class", "legend")
            .attr(
                "transform",
                `translate(${margin.left + plotWidth + 10}, ${margin.top})`,
            );
    }

    legend
        .selectAll("g")
        .data(stocks, (d: any) => d.symbol)
        .join(
            (enter) => {
                const gEnter = enter.append("g").attr("transform", (d, i) => {
                    let yOffset = 0;
                    for (let j = 0; j < i; j++) {
                        const lineCount = wrapText(
                            stocks[j].symbol,
                            LEGEND_MAX_CHARS_PER_LINE,
                        ).length;
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
                    .style("line-height", "16px")
                    .style("fill", "var(--fg)");

                textElement.selectAll("tspan").remove();
                textElement
                    .selectAll("tspan")
                    .data((d: any) =>
                        wrapText(d.symbol, LEGEND_MAX_CHARS_PER_LINE),
                    )
                    .enter()
                    .append("tspan")
                    .attr("x", 20)
                    .attr("dy", (_, i) => (i === 0 ? 0 : "16px"))
                    .text((d: string) => d);

                // Ajouter le rectangle après le texte
                const rect = gEnter
                    .insert("rect", "text")
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("fill", (d) => color(d.symbol));

                // Positionner le rect au centre vertically
                rect.attr("y", (d: any) => {
                    const lineCount = wrapText(
                        d.symbol,
                        LEGEND_MAX_CHARS_PER_LINE,
                    ).length;
                    const textHeight =
                        lineCount == 1 ? -11 : lineCount == 2 ? -3 : 5; // ajustement pour une ligne
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
                                const lineCount = wrapText(
                                    stocks[j].symbol,
                                    LEGEND_MAX_CHARS_PER_LINE,
                                ).length;
                                yOffset += Math.max(lineCount * 16 + 8, 25);
                            }
                            return `translate(0,${yOffset})`;
                        });

                    // Mettre à jour le texte
                    update.select("text").selectAll("tspan").remove();
                    update
                        .select("text")
                        .selectAll("tspan")
                        .data((d: any) =>
                            wrapText(d.symbol, LEGEND_MAX_CHARS_PER_LINE),
                        )
                        .enter()
                        .append("tspan")
                        .attr("x", 20)
                        .attr("dy", (_, i) => (i === 0 ? 0 : "16px"))
                        .text((d: string) => d);

                    // Mettre à jour le rect
                    update.select("rect").attr("y", (d: any) => {
                        const lineCount = wrapText(
                            d.symbol,
                            LEGEND_MAX_CHARS_PER_LINE,
                        ).length;
                        const textHeight =
                            lineCount == 1 ? -11 : lineCount == 2 ? -3 : 5; // ajustement pour une ligne
                        return textHeight;
                    });
                }),
            (exit) =>
                exit.call((exit) =>
                    exit.transition().duration(500).attr("opacity", 0).remove(),
                ),
        );
    // Cercle focus (point mobile)
    let focus = plotArea.select<SVGGElement>("g.focus");

    if (focus.empty()) {
        focus = plotArea
            .append("g")
            .attr("class", "focus")
            .style("display", "none");

        focus
            .append("circle")
            .attr("r", 5)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5);
    }
    // Zone pour capter la souris
    let mouseRect = plotArea.select<SVGRectElement>("rect.mouse-capture");

    if (mouseRect.empty()) {
        mouseRect = plotArea
            .append("rect")
            .attr("class", "mouse-capture")
            .attr("width", plotWidth)
            .attr("height", plotHeight)
            .attr("fill", "none")
            .attr("pointer-events", "all");
    }
    mouseRect
        .on("mousemove", (event) => {
            const [mx, my] = d3.pointer(event);
            const x0 = xScaleZoom.invert(mx);

            let closestStock: any = null;
            let closestValue: any = null;
            let minDist = Infinity;

            stocks.forEach((stock) => {
                const bisect = d3.bisector(x).left;
                let i = bisect(stock.values, x0);
                // s'assurer que i n'est pas hors tableau
                if (i >= stock.values.length) i = stock.values.length - 1;

                // prendre les points i et i-1 si possible
                const d1 = stock.values[i];
                const d0 = i > 0 ? stock.values[i - 1] : d1;

                // comparer les distances horizontales à x0
                const dx0 = Math.abs((x(d0) as Date).getTime() - x0.getTime());
                const dx1 = Math.abs((x(d1) as Date).getTime() - x0.getTime());

                const closestPoint = dx0 < dx1 ? d0 : d1;

                const dy = Math.abs(yScaleZoom(y(closestPoint)) - my); //distance verticale
                if (dy < minDist) {
                    minDist = dy;
                    closestStock = stock;
                    closestValue = closestPoint;
                }
            });

            if (!closestStock || !closestValue) return;
            const svgNode = svg_animated.node()!;
            const point = svgNode.createSVGPoint();

            // coordonnées EXACTES du point focus dans le SVG
            point.x = margin.left + xScaleZoom(x(closestValue!));
            point.y = margin.top + yScaleZoom(y(closestValue!));

            // transformation vers coordonnées écran
            const screenPoint = point.matrixTransform(
                svgNode.getScreenCTM() as any,
            );
            //gestion du tooltip

            const symbol = closestStock.symbol.toLowerCase();
            const allCountries = new Set(
                stocks.map((s) => s.symbol.split(" - ")[0]),
            );
            const multipleCountries = allCountries.size > 1;
            const parts = closestStock.symbol
                .split(" - ")
                .map((p: any) => p.trim());
            const country = parts[0];
            const product = parts[1];

            const title = multipleCountries
                ? `${country} – ${product}`
                : `${product}`;

            // Récupération de la valeur numérique
            const numericValue = y(closestValue!);

            const unit = symbol.includes("valeur")
                ? t("euro-unit")
                : symbol.includes("volume")
                  ? t("ton-unit-count", { count: numericValue })
                  : "";
            // Formattage de la valeur
            const formattedValue = d3
                .format(",.0f")(numericValue)
                .replace(/,/g, " ");

            // Construction du tooltip
            Tooltip.style("opacity", 0.8)
                .html(
                    `
                    <strong>${title}</strong><br>
                    ${t("value")} ${formattedValue} ${unit}<br>
                    ${t("date")} ${d3.timeFormat("%Y-%m-%d")(x(closestValue!) as Date)}
                    `,
                )
                .style("left", `${screenPoint.x + 10}px`)
                .style("top", `${screenPoint.y + 600}px`);

            // Afficher le focus
            focus.style("display", null);

            focus.attr(
                "transform",
                `translate(${xScaleZoom(x(closestValue!))},${yScaleZoom(y(closestValue!))})`,
            );

            focus.select("circle").attr("fill", color(closestStock.symbol));
        })
        .on("mouseleave", () => {
            Tooltip.style("opacity", 0);
            focus.style("display", "none");
        });

    const zoom = d3
        .zoom()
        .scaleExtent([1, 10])
        .translateExtent([
            [0, 0],
            [plotWidth, plotHeight],
        ])
        .extent([
            [0, 0],
            [plotWidth, plotHeight],
        ])
        .on("zoom", (event) => {
            const t = event.transform;

            xScaleZoom = t.rescaleX(xScale);
            yScaleZoom = t.rescaleY(yScale);

            // mettre à jour les lignes
            plotArea.selectAll(".line").attr("d", (d: any) =>
                d3
                    .line()
                    .x((d: any) => xScaleZoom(x(d)))
                    .y((d: any) => yScaleZoom(y(d)))(d.values),
            );
            // Mettre à jour les icônes lors du zoom
            iconsGroup
                .selectAll(".icon-hover-rect")
                .attr("x", (d: any) => xScaleZoom(d.dateParsed) - iconSize / 2);

            iconsGroup
                .selectAll(".event-icon")
                .attr("x", (d: any) => xScaleZoom(d.dateParsed) - iconSize / 2);

            // mettre à jour les axes
            (gX as any).call(
                (d3.axisBottom(xScaleZoom) as any).tickFormat(
                    d3.timeFormat("%b %Y"),
                ),
            );
            gY.call(d3.axisLeft(yScaleZoom));
        });

    // Vérifier si un zoom est déjà appliqué
    // Attacher le zoom uniquement au plotArea
    const gZoom = plotArea; // ou un g parent de plotArea si besoin
    // Réinitialiser le zoom existant sur plotArea si nécessaire
    if (gZoom.property("__zoom")) {
        gZoom.property("__zoom", null);
    }
    gZoom.call(zoom as any);
    return svg_animated.node();
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

function updateColorDomain(
    color_graphique: d3.ScaleOrdinal<string, string, never>,
    knownSymbols: Set<string>,
    stocks: any[],
) {
    stocks.forEach((s) => knownSymbols.add(s.symbol));
    color_graphique.domain([...knownSymbols]);
}
