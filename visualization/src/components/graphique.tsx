"use client";

import * as d3 from "d3";
import { useGlobal } from "./globalProvider";
import { type JSX, useEffect, useRef, useState } from "react";
import type_data from "@/data/N027_LIB.json";
import pays from "@/data/country_extended.json";
import list_products from "@/data/N890_LIB.json";
import all_icons from "@/data/symboles.json";


interface GraphiqueProps {
  allData: { [key: string]: number[][] };
  type: number[];
  productsSelected: number[];
  countriesSelected: number[];
  iconSelected: String[];
  all_events: any;
}
type Country = {
  code: string;
  en: string;
  fr: string;
};

interface DataPoint {
  date: Date;
  pays?: string;
  produit?: string;
  type?: string;
  value: number;
}


export default function Graphique({
  allData,
  type,
  productsSelected,
  countriesSelected,
  iconSelected,
  all_events,
}: GraphiqueProps): JSX.Element {
  const { windowSize } = useGlobal();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const knownSymbolsRef = useRef<Set<string>>(new Set());//l'ensemble des symboles pour la légende
  //countriesSelected = [34] //on fixe un pays pour le débug, sinon il prend tt les pays si rien n'est indiqué
  const data_plot = filterData(allData, { type, productsSelected, countriesSelected })
  const groupedData = d3.group(data_plot, d => d.type, d => d.pays, d => d.produit);
  const groupedData_plot = Array.from(groupedData, ([key, values]) => ({
    symbol: key,       // le nom de la série
    values: values     // array d'objets {date, VALEUR, ...}
  }));
  const flatten_data_plot = flattenGroupedData3(groupedData_plot)
  //on importe la map des icones que on filtre
  const typeMap: Record<string, any> = all_icons;
  const map_icons: Record<string, any> =
    Object.fromEntries(
      Object.entries(typeMap)
        .filter(([key]) => iconSelected.includes(key))
    );
  const events_filtered = filterevents(all_events, map_icons)
  console.log("events")
  console.log(events_filtered)
  //init du SVG
  useEffect(() => {
    if (!svgRef.current && containerRef.current) {
      svgRef.current = d3.select(containerRef.current)
        .append("svg")
        .attr("viewBox", `0 0 ${windowSize.width} ${windowSize.height}`)
        .attr("width", "95%")
        .attr("height", "95%");
    }
  }, [windowSize]);
  // --- Mise à jour du graphique quand les données changent
  useEffect(() => {
    if (!svgRef.current || flatten_data_plot.length === 0) return;
    updateMultiLines_with_icons(
      flatten_data_plot,
      svgRef.current, // c'est déjà une D3 selection
      knownSymbolsRef.current,
      map_icons,
      events_filtered,
      { x: d => d.date, y: d => d.value }
    );
  }, [flatten_data_plot, map_icons, events_filtered]);



  //On retourne le container
  return <div className="Graphique" ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}


function filterData(
  allData: { [key: string]: number[][] },
  { type,
    productsSelected,
    countriesSelected,
  }: {
    type: number[];
    productsSelected: number[];
    countriesSelected: number[];
  },
): DataPoint[] {
  if (!allData || Object.keys(allData).length === 0) {
    return [];
  }
  const parseDateMonth = d3.timeParse("%m %Y");
  const monthToJSMonth: Record<number, number> = {//conversion de l'id en mois réel
    6: 0, 11: 1, 1: 2, 12: 3, 5: 4, 10: 5, 4: 6, 8: 7, 2: 8, 3: 9, 9: 10, 7: 11
  };


  const countryMap = new Map<string, Country>(
    Object.entries(pays)
  );
  const typeMap: Record<string, string> = type_data;
  const produitMap: Record<string, string> = list_products;
  return Object.entries(allData)//il faut ajouter l'attribut year pour chaque année
    .flatMap(([year, yearData]) =>
      yearData.map((d: any) => ({
        ...d,
        year: +year // ajoute l'année
      }))
    )
    .filter((d, i) => {
      const countryId = d[0];
      const typeId = d[1];
      const monthid = d[2];
      const productId = d[3];

      if (productsSelected.length && !productsSelected.includes(productId)) {
        return false;
      }

      if (countriesSelected.length && !countriesSelected.includes(countryId)) {
        return false;
      }

      if (type.length && !type.includes(typeId)) {
        return false;
      }

      if (monthid == 0) {//on vire le mois 0 qui correspond au total par an
        return false;
      }

      return true;
    })
    .map(d => {
      // convertir le mois en objet Date
      const parsedDate = parseDateMonth(`${monthToJSMonth[d[2] as keyof typeof monthToJSMonth]} ${d.year}`);

      return {
        date: parsedDate ?? new Date(0), // si parseDateMonth retourne null, on met 1er Jan 1970
        pays: countryMap.get(String(d[0]))?.fr,
        produit: produitMap[String(d[3])],
        type: typeMap[String(d[1])],
        value: +d[4]
      } as DataPoint;
    })

    .filter(d => !isNaN(d.value)).sort((a: any, b: any) => a.date - b.date);
}

function filterevents(events: any[], map_icons: Record<string, any>) {
  //données traités pour avoir les infos des icones
  const parseDate1 = d3.timeParse("%Y-%m-%d"); // parsing date pour les icones
  const parseDate2 = d3.timeParse("%Y-%m");
  const eventsWithIcons = events
    .map(event => {
      // parse de la date
      const dateParsed = parseDate1(event.date) ? parseDate1(event.date) : parseDate2(event.date) ? parseDate2(event.date) : null;
      if (!dateParsed) return null;

      // catégorie / icône
      let category = "";
      let icon = null;

      if (event.catégorie) {
        const typeList = event.catégorie.split(" / ");
        category = typeList.find((t: any) => t in map_icons) || "";
        icon = map_icons[category] || null;
      } else {
        icon = map_icons[category] || null;
      }

      if (!icon) return null;
      const id = `icon-${category.toLowerCase().replace(/\s+/g, '-')}`;
      return {
        ...event,          // on garde toutes les infos originales
        dateParsed,        // date prête à l’emploi
        category,          // catégorie finale
        id                  //id associée
      };
    })
    .filter(d => d !== null); // on enlève les events invalides
  return eventsWithIcons
}

function flattenGroupedData3(groupedData: any[]) {
  //utilisé pour flatten un groupe avec 3 éléments
  const flattened: { symbol: string; type: any; zone: any; product: any; values: any; }[] = [];

  groupedData.forEach(d => {
    d.values.forEach((productMap: any[], country: any) => {
      productMap.forEach((values, product) => {
        flattened.push({
          symbol: `${country} - ${product} - ${d.symbol}`,
          type: d.symbol,
          zone: country,
          product: product,
          values: values
        });
      });
    });
  });

  return flattened;
}

function cssSafe(str: string) {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function updateColorDomain(color_graphique: d3.ScaleOrdinal<string, string, never>, knownSymbols: Set<string>, stocks: any[]) {
  stocks.forEach(s => knownSymbols.add(s.symbol));
  color_graphique.domain([...knownSymbols]);
}




function updateMultiLines_with_icons(//c'est la fonction pour mettre a jour de svg 
  stocks: { symbol: string; type: any; zone: any; product: any; values: any; }[],
  svg_animated: d3.Selection<SVGSVGElement, unknown, null, undefined>,//svg global
  knownSymbols: Set<string>,//ensemble de symboles que on a déjà vu
  map_icons: Record<string, any> | ArrayLike<unknown>,//le mapping nom -> élément svg
  events: unknown[] | Iterable<unknown> | d3.ValueFn<d3.BaseType, unknown, unknown[] | Iterable<unknown>>,//la liste des évènement qui a été filtré, on a ajouté la date parsé, la catégorie, et l'iconid associé

  {
    x = (d: DataPoint) => d.date,
    y = (d: DataPoint) => d.value

  } = {}
) {

  const width = 1200;
  const height = 500;
  const iconSize = 30; // taille d'affichage des icones
  const margin = { top: 40, right: 100, bottom: 40, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // créer le groupe plot principal si inexistant
  let g = svg_animated.select<SVGGElement>("g.plot");
  if (g.empty()) {
    g = svg_animated.append("g")
      .attr("class", "plot")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  }

  // couleurs
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  updateColorDomain(color, knownSymbols, stocks)

  // scales
  const xScale = d3.scaleTime()
    .domain([
      d3.min(stocks, s => d3.min(s.values, (d: any) => x(d)))!,
      d3.max(stocks, s => d3.max(s.values, (d: any) => x(d)))!
    ])
    .range([0, plotWidth]);

  const yScale = d3.scaleLinear()
    .domain([
      0,
      d3.max(stocks, s => d3.max(s.values, (d: any) => y(d)))!
    ])
    .nice()
    .range([plotHeight, 0]);
  let xScaleZoom = xScale;
  let yScaleZoom = yScale
  // axes
  let gX = g.select<SVGGElement>("g.xAxis");
  if (gX.empty()) {
    gX = g.append("g")
      .attr("class", "xAxis")
      .attr("transform", `translate(0,${plotHeight})`);
  }
  gX.transition().duration(800).call(d3.axisBottom(xScale));

  let gY = g.select<SVGGElement>("g.yAxis");
  if (gY.empty()) {
    gY = g.append("g")
      .attr("class", "yAxis");
  }
  gY.transition().duration(800).call(d3.axisLeft(yScale));


  const clipId = "clip-mouse-rect"  // ou un nom unique

  // créer defs si inexistant
  let defs = svg_animated.select<SVGGElement>("defs");
  if (defs.empty()) defs = svg_animated.append("defs");

  // vérifier si le clipPath existe déjà
  let clip = defs.select<SVGClipPathElement>(`#${clipId}`);

  if (clip.empty()) {
    clip = defs.append("clipPath")
      .attr("id", clipId);

    clip.append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight);
  }


  // Pour chaque catégorie d'icône, ajouter une définition si inexistante
  Object.entries(map_icons).forEach(([category, icon]) => {
    const id = `icon-${category.toLowerCase().replace(/\s+/g, '-')}`;

    // tester si l'icône existe déjà
    let iconDef = defs.select<SVGSVGElement>(`#${id}`);

    if (iconDef.empty()) {
      iconDef = defs.append("svg")
        .attr("id", id)
        .attr("viewBox", icon.viewBox)
        .attr("width", icon.viewBox.split(" ")[2])   // taille par défaut
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



  let plotArea = g.select<SVGGElement>("g.plot-area");
  if (plotArea.empty()) {
    plotArea = g.append("g")
      .attr("class", "plot-area")
      .attr("clip-path", `url(#${clipId})`);
  }


  // générateur de ligne
  let lineGen = d3.line<any>()
    .x(d => xScaleZoom(x(d)))
    .y(d => yScaleZoom(y(d)));



  // -------------------------------
  // JOIN des lignes avec clé symbol
  const t = plotArea.selectAll(".line")
    .data(stocks, (d: any) => d.symbol)
    .join(
      enter => enter.append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("stroke", d => color(d.symbol))
        .attr("opacity", 0)
        .attr("d", d => lineGen(d.values))
        .call(enter =>
          enter.transition()
            .duration(800)
            .attr("opacity", 1)
        ),
      update => update
        .call(update =>
          update.transition()
            .duration(800)
            .attr("d", d => lineGen(d.values))
            .attr("stroke", d => color(d.symbol))
        ),
      exit => exit
        .call(exit =>
          exit.transition()
            .duration(500)
            .attr("opacity", 0)
            .remove()
        )
    );


  let iconsGroup = g.select<SVGGElement>("g.icons");
  if (iconsGroup.empty()) {
    iconsGroup = g.append("g")
      .attr("class", "icons")
      .attr("transform", `translate(0, 0)`);
  }

  iconsGroup
    .selectAll("use.event-icon")
    .data(events, (d: any) => d.titre)
    .join(
      enter => enter.append("use")
        .attr("class", "event-icon")
        .attr("xlink:href", (d: any) => `#${d.id}`)
        .attr("x", (d: any) => xScaleZoom(d.dateParsed) - iconSize / 2)
        .attr("y", 0)
        .attr("width", iconSize)
        .attr("height", iconSize)
        .style("opacity", 0) // départ invisible
        .call(enter => enter.transition()
          .duration(500)
          .style("opacity", 1) // apparition progressive
          .attr("y", 10)), // glisse vers y = 10
      update => update.transition()
        .duration(500)
        .attr("xlink:href", (d: any) => `#${d.id}`)
        .attr("x", (d: any) => xScaleZoom(d.dateParsed) - iconSize / 2)
        .attr("y", 10)
        .style("opacity", 1), // s'assure que l'icône est visible
      exit => exit.transition()
        .duration(300)
        .attr("y", -20)
        .style("opacity", 0) // disparition progressive
        .remove()
    )
    .on("mouseover", (e, d: any) => {
      tooltip.style("display", null)
        .attr("transform", `translate(${xScaleZoom(d.dateParsed) + 20}, ${20})`);
      tooltipText.text(d.titre);
    })
    .on("mouseout", () => tooltip.style("display", "none"))
  // -------------------------------
  // Légende
  let legend = svg_animated.select<SVGGElement>("g.legend");
  if (legend.empty()) {
    legend = svg_animated.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${margin.left + plotWidth + 10}, ${margin.top})`);
  }

  legend.selectAll("g")
    .data(stocks, (d: any) => d.symbol)
    .join(
      enter => {
        const gEnter = enter.append("g")
          .attr("transform", (d, i) => `translate(0,${i * 25})`);
        gEnter.append("rect")
          .attr("width", 15)
          .attr("height", 15)
          .attr("fill", d => color(d.symbol));
        gEnter.append("text")
          .attr("x", 20)
          .attr("y", 12)
          .text(d => d.symbol);
        return gEnter;
      },
      update => update
        .call(update =>
          update.transition()
            .duration(500)
            .attr("transform", (d, i) => `translate(0,${i * 25})`)
        ),
      exit => exit
        .call(exit =>
          exit.transition()
            .duration(500)
            .attr("opacity", 0)
            .remove()
        )
    );
  // Tooltip et cercle
  let tooltip = plotArea.select<SVGGElement>("g.tooltip");

  if (tooltip.empty()) {
    tooltip = plotArea.append("g")
      .attr("class", "tooltip")
      .style("display", "none");

    tooltip.append("circle")
      .attr("r", 5)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);

    tooltip.append("text")
      .attr("class", "tooltip-text")
      .attr("x", 10)
      .attr("y", -10)
      .attr("font-size", 12)
      .attr("font-weight", "bold");
  }
  const tooltipText = tooltip.select<SVGGElement>("text.tooltip-text");
  // Zone pour capter la souris
  let mouseRect = plotArea.select<SVGRectElement>("rect.mouse-capture");

  if (mouseRect.empty()) {
    mouseRect = plotArea.append("rect")
      .attr("class", "mouse-capture")
      .attr("width", plotWidth)
      .attr("height", plotHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all");
  }
  mouseRect.on("mousemove", (event) => {
    const [mx, my] = d3.pointer(event);
    const x0 = xScaleZoom.invert(mx);

    let closestStock: any = null;
    let closestValue: any = null;
    let minDist = Infinity;

    stocks.forEach(stock => {
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

      const dy = Math.abs(yScaleZoom(y(closestPoint)) - my);//distance verticale
      if (dy < minDist) {
        minDist = dy;
        closestStock = stock;
        closestValue = closestPoint;
      }
    });

    if (!closestStock || !closestValue) return;

    tooltip.style("display", null)
      .attr("transform", `translate(${xScaleZoom(x(closestValue!))},${yScaleZoom(y(closestValue!))})`);

    tooltip.select("circle")
      .attr("fill", color(closestStock.symbol));

    tooltipText.text(`${closestStock.symbol}: ${y(closestValue!)}`);
  })
    .on("mouseleave", () => tooltip.style("display", "none"));

  const zoom = d3.zoom()
    .scaleExtent([1, 10])
    .translateExtent([[0, 0], [plotWidth, plotHeight]])
    .extent([[0, 0], [plotWidth, plotHeight]])
    .on("zoom", (event) => {
      const t = event.transform;

      xScaleZoom = t.rescaleX(xScale);
      yScaleZoom = t.rescaleY(yScale);

      // mettre à jour les lignes
      plotArea.selectAll(".line")
        .attr("d", (d: any) =>
          d3.line()
            .x((d: any) => xScaleZoom(x(d)))
            .y((d: any) => yScaleZoom(y(d)))
            (d.values)
        );

      // mettre à jour les axes
      (gX as any).call(
        (d3.axisBottom(xScaleZoom) as any).tickFormat(d3.timeFormat("%b %Y"))
      );
      gY.call(d3.axisLeft(yScaleZoom));
    });

  // Vérifier si un zoom est déjà appliqué
  const hasZoom = svg_animated.property("__zoom") !== undefined;
  if (!hasZoom) {
    (svg_animated as any).call(zoom);
  }
  else {
    svg_animated.property("__zoom", null);
    (svg_animated as any).call(zoom);
  }




  return svg_animated.node();
}
