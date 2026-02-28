"use client";

import * as d3 from "d3";
import products from "@/data/products.json";

type FlattenSeries = {
    zone: string;
    product: string;
    type?: string;
    values: { value: number; date?: Date; monthId?: number; year?: number }[];
};

const JS_MONTH_TO_MONTH_ID: Record<number, number> = {
    0: 6,
    1: 11,
    2: 1,
    3: 12,
    4: 5,
    5: 10,
    6: 4,
    7: 8,
    8: 2,
    9: 3,
    10: 9,
    11: 7,
};

type ProductNode = {
    name: string;
    code: string;
    value?: number;
    rawValue?: number;
    children?: ProductNode[];
};

type TreemapBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type SvgWithTreemapState = SVGSVGElement & {
    __treemapOutsideHandler?: (event: MouseEvent) => void;
    __treemapPreviousBoxByCode?: Record<string, TreemapBox>;
    __treemapPreviousFocusCode?: string;
};

export default function updateTreemap(
    data: FlattenSeries[],
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    selectedCountryName?: string,
    selectedYear?: number,
    selectedMonth?: number,
    isBalanceMode: boolean = false,
    unitLabel: string = "",
) {
    if (!data || data.length === 0) return;

    const svgNode = svg.node();
    const svgWithState = svgNode as SvgWithTreemapState | null;

    const [width, height] = getSvgSize(svg);
    const margin = { top: 8, right: 8, bottom: 8, left: 8 };
    const innerWidth = Math.max(300, width - margin.left - margin.right);
    const innerHeight = Math.max(300, height - margin.top - margin.bottom);

    const availableCountries = Array.from(new Set(data.map((d) => d.zone)));
    const targetCountry =
        selectedCountryName && availableCountries.includes(selectedCountryName)
            ? selectedCountryName
            : availableCountries[0];

    const valueMatchesSelectedDate = (point: {
        date?: Date;
        monthId?: number;
        year?: number;
    }) => {
        if (selectedYear === undefined || selectedMonth === undefined) {
            return true;
        }

        const pointYear = point.year ?? point.date?.getFullYear();
        if (pointYear !== selectedYear) {
            return false;
        }

        if (selectedMonth === 0) {
            return true;
        }

        const inferredMonthId =
            point.monthId ??
            (point.date ? JS_MONTH_TO_MONTH_ID[point.date.getMonth()] : undefined);

        return inferredMonthId === selectedMonth;
    };

    const countryData = data
        .filter((d) => d.zone === targetCountry)
        .map((series) => ({
            ...series,
            values: series.values.filter(valueMatchesSelectedDate),
        }))
        .filter((series) => series.values.length > 0);

    if (countryData.length === 0) return;

    const rootData = buildHierarchy(countryData, targetCountry, isBalanceMode);
    if (!rootData.children || rootData.children.length === 0) return;

    const root = d3
        .treemap<ProductNode>()
        .tile(d3.treemapSquarify)
        .size([innerWidth, innerHeight])
        .paddingOuter(2)
        .paddingInner(1)
        .round(true)(
            d3
                .hierarchy(rootData)
                .sum((d) =>
                    d.children && d.children.length > 0
                        ? 0
                        : Math.max(0, d.value ?? 0),
                )
                .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
        );

    let chartRoot = svg.select<SVGGElement>(".treemap-root");
    if (chartRoot.empty()) {
        chartRoot = svg.append("g").attr("class", "treemap-root");
    }
    chartRoot.selectAll("*").remove();

    const container = chartRoot
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const format = (value: number) => d3.format(",d")(value).replace(/,/g, " ");
    const signedFormat = (value: number) =>
        d3.format("+,d")(value).replace(/,/g, " ");
    const withUnit = (valueText: string) =>
        unitLabel ? `${valueText} ${unitLabel}` : valueText;
    const previousBoxByCode = new Map<string, TreemapBox>(
        Object.entries(svgWithState?.__treemapPreviousBoxByCode ?? {}),
    );

    const headerHeight = 26;
    let legendHeight = 46;
    const findNodeByCode = (
        tree: d3.HierarchyRectangularNode<ProductNode>,
        code?: string,
    ) => {
        if (!code) return null;
        return tree
            .descendants()
            .find((node) => node.data.code === code) ?? null;
    };

    const persistedFocus = findNodeByCode(root, svgWithState?.__treemapPreviousFocusCode);
    let currentFocus: d3.HierarchyRectangularNode<ProductNode> =
        persistedFocus && persistedFocus.children && persistedFocus.children.length > 0
            ? persistedFocus
            : root;

    const previousOutsideHandler = svgWithState?.__treemapOutsideHandler;

    if (previousOutsideHandler) {
        document.removeEventListener("click", previousOutsideHandler);
    }

    chartRoot
        .insert("rect", ":first-child")
        .attr("class", "treemap-outside-catcher")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .on("click", () => {
            if (currentFocus.parent) {
                render(currentFocus.parent);
            }
        });

    const header = container
        .append("g")
        .attr("class", "treemap-header")
        .style("cursor", "pointer")
        .on("click", () => {
            if (currentFocus.parent) {
                render(currentFocus.parent);
            }
        });

    header
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", headerHeight)
        .attr("fill", "var(--bg)")
        .attr("stroke", "var(--color-text)")
        .attr("stroke-width", 0.6);

    const headerTrail = header
        .append("g")
        .attr("class", "treemap-breadcrumb")
        .attr("transform", "translate(8, 17)");

    const legend = container
        .append("g")
        .attr("class", "treemap-legend")
        .attr("transform", `translate(0, ${headerHeight + 4})`)
        .style("cursor", "pointer")
        .on("click", () => {
            if (currentFocus.parent) {
                render(currentFocus.parent);
            }
        });

    legend
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", legendHeight)
        .attr("fill", "var(--bg)")
        .attr("stroke", "var(--color-text)")
        .attr("stroke-width", 0.4)
        .attr("opacity", 0.85);

    const legendTitle = legend
        .append("text")
        .attr("x", 10)
        .attr("y", 15)
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "var(--color-text)");

    const legendItems = legend
        .append("g")
        .attr("class", "treemap-legend-items")
        .attr("transform", "translate(10, 28)");

    const plot = container
        .append("g")
        .attr("class", "treemap-plot")
        .attr("transform", `translate(0, ${headerHeight + legendHeight + 8})`)
        .on("click", () => {
            if (currentFocus.parent) {
                render(currentFocus.parent);
            }
        });

    plot
        .append("rect")
        .attr("class", "treemap-plot-bg")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", innerHeight - headerHeight - legendHeight - 8)
        .attr("fill", "var(--bg)")
        .attr("opacity", 0.35);

    const updatePlotLayout = () => {
        plot.attr(
            "transform",
            `translate(0, ${headerHeight + legendHeight + 8})`,
        );
        plot.select(".treemap-plot-bg")
            .attr("width", innerWidth)
            .attr("height", innerHeight - headerHeight - legendHeight - 8);
        legend.select("rect").attr("height", legendHeight);
    };

    const topLevelColors = new Map<string, string>(
        (root.children ?? []).map((node, index) => [
            node.data.code,
            d3.schemeTableau10[index % d3.schemeTableau10.length],
        ]),
    );

    const topLevelOf = (node: d3.HierarchyRectangularNode<ProductNode>) =>
        node.ancestors().find((ancestor) => ancestor.depth === 1);

    const onDocumentClickOutside = (event: MouseEvent) => {
        if (!svgNode || !event) return;

        const target = event.target as Node | null;
        if (target && svgNode.contains(target)) {
            return;
        }

        if (currentFocus.parent) {
            render(currentFocus.parent);
        }
    };

    document.addEventListener("click", onDocumentClickOutside);
    if (svgWithState) {
        svgWithState.__treemapOutsideHandler = onDocumentClickOutside;
    }

    function render(focus: d3.HierarchyRectangularNode<ProductNode>) {
        currentFocus = focus;

        const displayedNodeValue = (
            node: d3.HierarchyRectangularNode<ProductNode>,
        ) => {
            if (!isBalanceMode) {
                return node.value ?? 0;
            }
            if (!node.children || node.children.length === 0) {
                return node.data.rawValue ?? 0;
            }
            return d3.sum(node.leaves(), (leaf) => leaf.data.rawValue ?? 0);
        };

        const signSymbol = (node: d3.HierarchyRectangularNode<ProductNode>) => {
            const raw = displayedNodeValue(node);
            if (raw > 0) return "+";
            if (raw < 0) return "−";
            return "0";
        };

        const signColor = (node: d3.HierarchyRectangularNode<ProductNode>) => {
            const raw = displayedNodeValue(node);
            if (raw > 0) return "#1f7a3f";
            if (raw < 0) return "#b1262d";
            return "#6b7280";
        };

        const crumbs = focus.ancestors().reverse();
        const crumbLayout: {
            node: d3.HierarchyRectangularNode<ProductNode>;
            label: string;
            x: number;
            labelWidth: number;
            isCurrent: boolean;
        }[] = [];

        let cursor = 0;
        crumbs.forEach((node, index) => {
            const isCurrent = index === crumbs.length - 1;
            const label = node.data.name;
            const labelWidth = estimateTextWidth(label, 12, isCurrent);
            crumbLayout.push({ node, label, x: cursor, labelWidth, isCurrent });
            cursor += labelWidth;
            if (!isCurrent) {
                cursor += estimateTextWidth(" / ", 12, false);
            }
        });

        const crumbText = headerTrail
            .selectAll<SVGTextElement, (typeof crumbLayout)[number]>("text.crumb")
            .data(crumbLayout, (d) => d.node.data.code)
            .join(
                (enter) =>
                    enter
                        .append("text")
                        .attr("class", "crumb")
                        .style("font-size", "12px"),
                (update) => update,
                (exit) => exit.remove(),
            )
            .attr("x", (d) => d.x)
            .style("font-weight", (d) => (d.isCurrent ? "700" : "400"))
            .style("fill", "var(--color-text)")
            .style("cursor", (d) => (d.isCurrent ? "default" : "pointer"))
            .text((d) => d.label)
            .on("click", (event, d) => {
                if (d.isCurrent) return;
                event.stopPropagation();
                render(d.node);
            });

        const separators = crumbLayout
            .filter((d) => !d.isCurrent)
            .map((d) => ({ key: d.node.data.code, x: d.x + d.labelWidth }));

        headerTrail
            .selectAll<SVGTextElement, { key: string; x: number }>(
                "text.crumb-sep",
            )
            .data(separators, (d) => d.key)
            .join(
                (enter) =>
                    enter
                        .append("text")
                        .attr("class", "crumb-sep")
                        .style("font-size", "12px")
                        .style("fill", "var(--color-text)"),
                (update) => update,
                (exit) => exit.remove(),
            )
            .attr("x", (d) => d.x)
            .text(" / ");

        const nodes = (focus.children ?? []).filter(
            (node) => (node.value ?? 0) > 0,
        );

        const nodeValues = nodes.map((node) => node.value ?? 0);
        const minValue = d3.min(nodeValues) ?? 0;
        const maxValue = d3.max(nodeValues) ?? 1;

        const containerColor = (node: d3.HierarchyRectangularNode<ProductNode>) => {
            if (focus.depth === 0) {
                return topLevelColors.get(node.data.code) ?? "#4E79A7";
            }

            const top = topLevelOf(node) ?? focus;
            const baseColor = topLevelColors.get(top.data.code) ?? "#4E79A7";
            const base = d3.hsl(baseColor);
            const light = d3.hsl(base.h, Math.max(0.35, base.s * 0.65), Math.min(0.84, base.l + 0.22)).formatHex();
            const dark = d3.hsl(base.h, Math.min(0.9, base.s * 1.1), Math.max(0.22, base.l - 0.2)).formatHex();

            const scale = d3
                .scaleLinear<string>()
                .domain(maxValue === minValue ? [minValue, minValue + 1] : [minValue, maxValue])
                .range([light, dark])
                .interpolate(d3.interpolateHcl);

            return scale(node.value ?? 0);
        };

        const containerDepth = focus.depth + 1;
        legendTitle.text(
            `Conteneurs visibles (niveau ${containerDepth}) — clic pour entrer, clic fond pour revenir`,
        );

        const legendData = nodes;
        const legendLayout: {
            node: d3.HierarchyRectangularNode<ProductNode>;
            x: number;
            y: number;
        }[] = [];

        const markerWidth = 10;
        const itemGap = 10;
        const rowHeight = 13;
        const maxLegendWidth = innerWidth - 20;
        let legendX = 0;
        let legendY = 0;

        legendData.forEach((node) => {
            const textWidth = estimateTextWidth(node.data.name, 10, false);
            const itemWidth = markerWidth + 4 + textWidth + itemGap;

            if (legendX > 0 && legendX + itemWidth > maxLegendWidth) {
                legendX = 0;
                legendY += rowHeight;
            }

            legendLayout.push({ node, x: legendX, y: legendY });
            legendX += itemWidth;
        });

        legendHeight = Math.max(32, 24 + legendY + rowHeight + 6);
        updatePlotLayout();

        const legendItem = legendItems
            .selectAll<
                SVGGElement,
                {
                    node: d3.HierarchyRectangularNode<ProductNode>;
                    x: number;
                    y: number;
                }
            >("g.legend-item")
            .data(legendLayout, (d) => d.node.data.code)
            .join(
                (enter) => {
                    const group = enter.append("g").attr("class", "legend-item");
                    group
                        .append("rect")
                        .attr("width", 10)
                        .attr("height", 10)
                        .attr("y", -5)
                        .attr("stroke", "var(--color-text)")
                        .attr("stroke-width", 0.5);
                    group
                        .append("text")
                        .attr("x", 14)
                        .attr("y", 0)
                        .attr("dominant-baseline", "middle")
                        .style("font-size", "10px")
                        .style("fill", "var(--color-text)");
                    return group;
                },
                (update) => update,
                (exit) => exit.remove(),
            );

        legendItem.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
        legendItem.select("rect").attr("fill", (d) => containerColor(d.node));
        legendItem
            .select("text")
            .attr("x", 14)
            .attr("y", 0)
            .text((d) => d.node.data.name);

        const x = d3
            .scaleLinear()
            .domain([focus.x0, focus.x1])
            .range([0, innerWidth]);
        const y = d3
            .scaleLinear()
            .domain([focus.y0, focus.y1])
            .range([0, innerHeight - headerHeight - legendHeight - 8]);

        const transition = d3.transition().duration(550);

        const boxOf = (node: d3.HierarchyRectangularNode<ProductNode>) => ({
            x: x(node.x0),
            y: y(node.y0),
            width: Math.max(0, x(node.x1) - x(node.x0)),
            height: Math.max(0, y(node.y1) - y(node.y0)),
        });

        const cell = plot
            .selectAll<SVGGElement, d3.HierarchyRectangularNode<ProductNode>>("g.treemap-cell")
            .data(nodes, (d) => d.data.code)
            .join(
                (enter) => {
                    const g = enter
                        .append("g")
                        .attr("class", "treemap-cell")
                        .attr("transform", (d) => {
                            const previous = previousBoxByCode.get(d.data.code);
                            if (previous) {
                                return `translate(${previous.x},${previous.y})`;
                            }
                            const focusBox = boxOf(focus);
                            return `translate(${focusBox.x + focusBox.width / 2},${focusBox.y + focusBox.height / 2})`;
                        })
                        .style("opacity", 0.6)
                        .style("cursor", (d) => (d.children ? "zoom-in" : "default"))
                        .on("click", (event, d) => {
                            event.stopPropagation();
                            if (d.children && d.children.length > 0) {
                                render(d);
                            }
                        });

                    g.append("rect")
                        .attr("fill", (d) => containerColor(d))
                        .attr("fill-opacity", 0.92)
                        .attr("stroke", "var(--color-text)")
                        .attr("stroke-width", 1.1)
                        .attr("width", (d) => {
                            const previous = previousBoxByCode.get(d.data.code);
                            return previous ? previous.width : 0;
                        })
                        .attr("height", (d) => {
                            const previous = previousBoxByCode.get(d.data.code);
                            return previous ? previous.height : 0;
                        });

                    g.append("title");
                    g.append("text")
                        .style("font-size", "11px")
                        .style("fill", "var(--color-text)");

                    g.append("rect")
                        .attr("class", "treemap-sign-badge")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .attr("width", 0)
                        .attr("height", 0)
                        .style("pointer-events", "none")
                        .style("opacity", 0);

                    g.append("text")
                        .attr("class", "treemap-sign-label")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .style("font-size", "10px")
                        .style("font-weight", "700")
                        .style("fill", "white")
                        .style("pointer-events", "none")
                        .style("opacity", 0);

                    return g;
                },
                (update) => update,
                (exit) =>
                    exit
                        .transition(transition)
                        .style("opacity", 0)
                        .remove(),
            );

        cell
            .transition(transition)
            .style("opacity", 1)
            .attr("transform", (d) => `translate(${x(d.x0)},${y(d.y0)})`);

        cell
            .select("rect")
            .transition(transition)
            .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0)))
            .attr("height", (d) => Math.max(0, y(d.y1) - y(d.y0)))
            .attr("fill", (d) => containerColor(d));

        cell
            .select("title")
            .text((d) => {
                const path = d
                    .ancestors()
                    .reverse()
                    .map((node) => node.data.name)
                    .join(" / ");
                const valueText = isBalanceMode
                    ? `Solde: ${withUnit(signedFormat(Math.round(displayedNodeValue(d))))}`
                    : withUnit(format(Math.round(d.value ?? 0)));
                return `${path}\n${valueText}`;
            });

        cell
            .select("text")
            .attr("x", 4)
            .attr("y", 14)
            .text((d) => {
                const w = Math.max(0, x(d.x1) - x(d.x0));
                const h = Math.max(0, y(d.y1) - y(d.y0));
                if (w < 85 || h < 26) return "";
                if (isBalanceMode) {
                    return `${d.data.name} · ${withUnit(signedFormat(Math.round(displayedNodeValue(d))))}`;
                }
                return `${d.data.name} · ${withUnit(format(Math.round(d.value ?? 0)))}`;
            });

        cell
            .select<SVGRectElement>("rect.treemap-sign-badge")
            .transition(transition)
            .style("opacity", (d) => {
                if (!isBalanceMode) return 0;
                const w = Math.max(0, x(d.x1) - x(d.x0));
                const h = Math.max(0, y(d.y1) - y(d.y0));
                return w >= 48 && h >= 30 ? 1 : 0;
            })
            .attr("width", (d) => {
                if (!isBalanceMode) return 0;
                const w = Math.max(0, x(d.x1) - x(d.x0));
                const h = Math.max(0, y(d.y1) - y(d.y0));
                return w >= 48 && h >= 30 ? 16 : 0;
            })
            .attr("height", (d) => {
                if (!isBalanceMode) return 0;
                const w = Math.max(0, x(d.x1) - x(d.x0));
                const h = Math.max(0, y(d.y1) - y(d.y0));
                return w >= 48 && h >= 30 ? 16 : 0;
            })
            .attr("x", (d) => {
                const w = Math.max(0, x(d.x1) - x(d.x0));
                return Math.max(2, w - 18);
            })
            .attr("y", 2)
            .attr("fill", (d) => signColor(d));

        cell
            .select<SVGTextElement>("text.treemap-sign-label")
            .transition(transition)
            .style("opacity", (d) => {
                if (!isBalanceMode) return 0;
                const w = Math.max(0, x(d.x1) - x(d.x0));
                const h = Math.max(0, y(d.y1) - y(d.y0));
                return w >= 48 && h >= 30 ? 1 : 0;
            })
            .text((d) => (isBalanceMode ? signSymbol(d) : ""))
            .attr("x", (d) => {
                const w = Math.max(0, x(d.x1) - x(d.x0));
                return Math.max(10, w - 10);
            })
            .attr("y", 10);

        const subLines = cell
            .selectAll<SVGRectElement, d3.HierarchyRectangularNode<ProductNode>>(
                "rect.treemap-subline",
            )
            .data(
                (d) => (d.children ?? []).filter((child) => (child.value ?? 0) > 0),
                (d) => d.data.code,
            )
            .join(
                (enter) => {
                    return enter
                        .append("rect")
                        .attr("class", "treemap-subline")
                        .attr("fill", "none")
                        .attr("stroke", "#0B3D91")
                        .attr("stroke-opacity", 0.85)
                        .attr("stroke-width", 1)
                        .attr("pointer-events", "none")
                        .attr("x", (child) => {
                            const previous = previousBoxByCode.get(child.data.code);
                            const parent = child.parent;
                            if (!previous || !parent) return 0;
                            const parentBox = boxOf(parent);
                            return previous.x - parentBox.x;
                        })
                        .attr("y", (child) => {
                            const previous = previousBoxByCode.get(child.data.code);
                            const parent = child.parent;
                            if (!previous || !parent) return 0;
                            const parentBox = boxOf(parent);
                            return previous.y - parentBox.y;
                        })
                        .attr("width", (child) => {
                            const previous = previousBoxByCode.get(child.data.code);
                            return previous ? previous.width : 0;
                        })
                        .attr("height", (child) => {
                            const previous = previousBoxByCode.get(child.data.code);
                            return previous ? previous.height : 0;
                        })
                        .style("opacity", 0.55);
                },
                (update) => update,
                (exit) =>
                    exit
                        .transition(transition)
                        .style("opacity", 0)
                        .attr("width", 0)
                        .attr("height", 0)
                        .remove(),
            );

        subLines
            .transition(transition)
            .style("opacity", 1)
            .attr("x", (child) => {
                const parent = child.parent;
                if (!parent) return 0;
                return x(child.x0) - x(parent.x0);
            })
            .attr("y", (child) => {
                const parent = child.parent;
                if (!parent) return 0;
                return y(child.y0) - y(parent.y0);
            })
            .attr("width", (child) => {
                return Math.max(0, x(child.x1) - x(child.x0));
            })
            .attr("height", (child) => {
                return Math.max(0, y(child.y1) - y(child.y0));
            })
            .attr("stroke", (child) => {
                const base = d3.color(containerColor(child));
                return base ? base.darker(1).formatHex() : "#0B3D91";
            });

        nodes.forEach((node) => {
            previousBoxByCode.set(node.data.code, boxOf(node));
            (node.children ?? []).forEach((child) => {
                previousBoxByCode.set(child.data.code, boxOf(child));
            });
        });

        if (svgWithState) {
            svgWithState.__treemapPreviousFocusCode = focus.data.code;
            svgWithState.__treemapPreviousBoxByCode = Object.fromEntries(
                previousBoxByCode.entries(),
            );
        }
    }

    render(currentFocus);
}

type ProductMetadata = {
    name: string;
    code: string;
    parentCode: string;
};

function buildHierarchy(
    data: FlattenSeries[],
    countryName: string,
    isBalanceMode: boolean,
): ProductNode {
    const productByName = new Map<string, ProductMetadata>();
    const productByCode = new Map<string, ProductMetadata>();
    const childrenByParent = new Map<string, string[]>();

    Object.values(products).forEach((product) => {
        const parentCode = product.code.split(".").slice(0, -1).join(".");
        const metadata: ProductMetadata = {
            name: product.name,
            code: product.code,
            parentCode,
        };

        if (!productByName.has(product.name)) {
            productByName.set(product.name, metadata);
        }
        productByCode.set(product.code, metadata);

        if (!childrenByParent.has(parentCode)) {
            childrenByParent.set(parentCode, []);
        }
        childrenByParent.get(parentCode)!.push(product.code);
    });

    const valuesByCode = new Map<string, number>();
    const rawValuesByCode = new Map<string, number>();
    data.forEach((item) => {
        const metadata = productByName.get(item.product);
        if (!metadata) return;

        const value = d3.sum(item.values, (point) => +point.value || 0);
        if (!Number.isFinite(value) || value === 0) return;

        if (isBalanceMode) {
            const typeLabel = (item.type ?? "").toLowerCase();
            const sign = typeLabel.includes("import")
                ? -1
                : typeLabel.includes("export")
                    ? 1
                    : 0;

            if (sign === 0) return;
            const nextRaw = (rawValuesByCode.get(metadata.code) ?? 0) + sign * value;
            rawValuesByCode.set(metadata.code, nextRaw);
            valuesByCode.set(metadata.code, Math.abs(nextRaw));
            return;
        }

        const positiveValue = Math.abs(value);
        valuesByCode.set(
            metadata.code,
            (valuesByCode.get(metadata.code) ?? 0) + positiveValue,
        );
        rawValuesByCode.set(
            metadata.code,
            (rawValuesByCode.get(metadata.code) ?? 0) + positiveValue,
        );
    });

    const leafCodes = Array.from(valuesByCode.keys()).filter((code) => {
        return !Array.from(valuesByCode.keys()).some(
            (otherCode) => otherCode !== code && otherCode.startsWith(`${code}.`),
        );
    });

    const includedCodes = new Set<string>();
    leafCodes.forEach((code) => {
        let current = code;
        while (current) {
            includedCodes.add(current);
            current = current.split(".").slice(0, -1).join(".");
        }
    });

    function buildNode(code: string): ProductNode | null {
        const metadata = productByCode.get(code);
        if (!metadata) return null;

        const childNodes = (childrenByParent.get(code) ?? [])
            .filter((childCode) => includedCodes.has(childCode))
            .map((childCode) => buildNode(childCode))
            .filter((child): child is ProductNode => child !== null);

        const ownValue = valuesByCode.get(code);
        if (childNodes.length === 0 && ownValue === undefined) {
            return null;
        }

        return {
            name: metadata.name,
            code,
            ...(childNodes.length ? { children: childNodes } : {}),
            ...(ownValue !== undefined ? { value: ownValue } : {}),
            ...(rawValuesByCode.get(code) !== undefined
                ? { rawValue: rawValuesByCode.get(code) }
                : {}),
        };
    }

    const tree = buildNode("0");
    return tree ?? { name: countryName, code: "0", children: [] };
}

function getSvgSize(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
): [number, number] {
    const viewBox = svg.attr("viewBox");
    if (viewBox) {
        const parts = viewBox
            .split(/\s+/)
            .map((part) => Number(part))
            .filter((part) => Number.isFinite(part));
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            return [parts[2], parts[3]];
        }
    }

    const width = Number(svg.attr("width"));
    const height = Number(svg.attr("height"));
    if (Number.isFinite(width) && Number.isFinite(height)) {
        return [width, height];
    }

    return [1100, 650];
}

function estimateTextWidth(
    text: string,
    fontSize: number,
    isBold: boolean,
): number {
    const baseFactor = isBold ? 0.64 : 0.6;
    return Math.max(8, text.length * fontSize * baseFactor);
}
