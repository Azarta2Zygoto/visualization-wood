"use client";

import { type JSX, RefObject, useEffect, useMemo, useRef, useState } from "react";

import * as d3 from "d3";

import type_data from "@/data/N027_LIB.json";
import list_products from "@/data/N890_LIB.json";
import pays from "@/data/country_extended.json";
import all_icons from "@/data/symboles.json";
import updateMultiLines_with_icons from "@/components/line_chart_with_icons"
import updateMirrorStackedAreaChart from "@/components/mirror_stacked_area_chart"
import { useGlobal } from "./globalProvider";

interface GraphiqueProps {
    allData: { [key: string]: number[][] };
    type: number[];
    productsSelected: number[];
    countriesSelected: number[];
    iconSelected: string[];
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

type NestedMap3 = Map<
    number, // countryId
    Map<
        number, // productId
        Map<
            number, // typeId
            { date: Date; value: number }[]
        >
    >
>;


export default function Graphique({
    allData,
    type,
    productsSelected,
    countriesSelected,
    iconSelected,
    all_events,
}: GraphiqueProps): JSX.Element {
    const { windowSize } = useGlobal();
    if ((type.length == 1) && (type[0] == 4)) {
        type = [2, 3]//Si on est en balance, on charge les infos d'import et d'export en €
    }
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<d3.Selection<
        SVGSVGElement,
        unknown,
        null,
        undefined
    > | null>(null);
    const knownSymbolsRef = useRef<Set<string>>(new Set()); //l'ensemble des symboles pour la légende
    // map globale : country → product → type → array de {date, value}
    // chaque année est contenue dans le tableau de chaque entrée
    const globalNestedMap = useRef<NestedMap3>(new Map());//la big map
    const processedYears = useRef<Set<string>>(new Set()); // années déjà calculées
    const [dataVersion, setDataVersion] = useState(0);//cette variable sert a trigger le nouveau graphique quand les données changent
    //countriesSelected = [34]; //on fixe un pays pour le débug, sinon il prend tt les pays si rien n'est indiqué
    const current_graph = useRef<Number>(0)
    // ajouter toutes les nouvelles années dans la map
    useEffect(() => {
        let updated = false;

        Object.keys(allData).forEach((year) => {
            const before = processedYears.current.size;

            addYearToNestedMap(allData, year, globalNestedMap, processedYears);

            if (processedYears.current.size > before) {
                updated = true;
            }
        });

        if (updated) {
            setDataVersion(v => v + 1);
        }
    }, [allData]);

    const data_plot = useMemo(() => {
        return flattenGlobalMap(
            globalNestedMap,
            type,
            productsSelected,
            countriesSelected
        );
    }, [type, productsSelected, countriesSelected, dataVersion]);//on utilise dataVersion pour trigger le changement

    const globalAllDates = useMemo(() => {
        const dates = new Set<number>();

        const nestedMap = globalNestedMap.current;

        for (const [, productMap] of nestedMap) {
            for (const [, typeMap] of productMap) {
                for (const [, entries] of typeMap) {
                    entries.forEach(e => {
                        dates.add(+e.date);
                    });
                }
            }
        }

        return Array.from(dates)
            .map(d => new Date(d))
            .sort(d3.ascending);

    }, [dataVersion]);

    const groupedData_plot = useMemo(() => {
        console.log("group data");
        console.time("groupedData");

        const groupedData = d3.group(
            data_plot,
            (d) => d.type,
            (d) => d.pays,
            (d) => d.produit,
        );
        console.timeEnd("groupedData")

        return Array.from(groupedData, ([key, values]) => ({
            symbol: key, // le nom de la série
            values, // array d'objets {date, VALEUR, ...}
        }));
    }, [data_plot]);

    const flatten_data_plot = useMemo(() => {
        console.log("flatten data");
        return flattenGroupedData3(groupedData_plot);
    }, [groupedData_plot]);

    //on importe la map des icones que on filtre
    const map_icons = useMemo(() => {
        console.log("load icon data");
        return Object.fromEntries(
            Object.entries(all_icons).filter(([key]) =>
                iconSelected.includes(key),
            ),
        );
    }, [iconSelected]);

    const events_filtered = useMemo(() => {
        console.log("filter event");
        return filterevents(all_events, map_icons, countriesSelected);
    }, [all_events, map_icons, countriesSelected]);


    //init du SVG
    useEffect(() => {
        if (!svgRef.current && containerRef.current) {
            svgRef.current = d3
                .select(containerRef.current)
                .append("svg")
                .attr(
                    "viewBox",
                    `0 0 ${windowSize.width - 20} ${windowSize.height}`,
                )
                .attr("width", "95%")
                .attr("height", "95%");
        }
    }, [windowSize]);
    // --- Mise à jour du graphique quand les données changent
    useEffect(() => {
        if (!svgRef.current || flatten_data_plot.length === 0) return;
        if (countriesSelected.length == 1 && type.length == 2) {
            update_current_graphique(current_graph, 1, svgRef.current)
            updateMirrorStackedAreaChart(format_stacked_area_from_flatten(flatten_data_plot), svgRef.current, globalAllDates)
        }
        else {
            update_current_graphique(current_graph, 0, svgRef.current)
            updateMultiLines_with_icons(
                flatten_data_plot,
                svgRef.current, // c'est déjà une D3 selection
                knownSymbolsRef.current,
                map_icons,
                events_filtered,
                { x: (d) => d.date, y: (d) => d.value },
            );
        }

    }, [flatten_data_plot, map_icons, events_filtered]);

    //On retourne le container
    return (
        <div
            className="Graphique"
            ref={containerRef}
        />
    );
}
function addYearToNestedMap(
    allData: { [key: string]: number[][] },
    year: string,
    nestedMapRef: RefObject<NestedMap3>,
    processedYearsRef: RefObject<Set<string>>
) {
    if (!allData[year] || processedYearsRef.current.has(year)) return;

    const parseDateMonth = d3.timeParse("%m %Y");
    const monthToJSMonth: Record<number, number> = {
        6: 0, 11: 1, 1: 2, 12: 3, 5: 4, 10: 5, 4: 6, 8: 7, 2: 8, 3: 9, 9: 10, 7: 11,
    };

    const yearData = allData[year];

    for (const d of yearData) {
        const countryId = d[0];
        const typeId = d[1];
        const monthId = d[2];
        const productId = d[3];
        const value = +d[4];

        if (monthId === 0 || isNaN(value)) continue;

        const date =
            parseDateMonth(`${monthToJSMonth[monthId as keyof typeof monthToJSMonth]} ${year}`) ?? new Date(0);

        const nestedMap = nestedMapRef.current;

        // niveau 1 : country
        if (!nestedMap.has(countryId)) nestedMap.set(countryId, new Map());
        const productMap = nestedMap.get(countryId)!;

        // niveau 2 : product
        if (!productMap.has(productId)) productMap.set(productId, new Map());
        const typeMap = productMap.get(productId)!;

        // niveau 3 : type
        if (!typeMap.has(typeId)) typeMap.set(typeId, []);
        const entries = typeMap.get(typeId)!;

        entries.push({ date, value });
    }

    processedYearsRef.current.add(year);
}

function flattenGlobalMap(
    nestedMapRef: RefObject<NestedMap3>,
    type: number[],
    productsSelected: number[],
    countriesSelected: number[],
): DataPoint[] {
    const countryMap = new Map<string, Country>(Object.entries(pays));
    const typeMap: Record<string, string> = type_data;
    const produitMap: Record<string, string> = list_products;

    const result: DataPoint[] = [];
    const nestedMap = nestedMapRef.current;

    for (const [countryId, productMap] of nestedMap) {
        if (countriesSelected.length && !countriesSelected.includes(countryId)) continue;

        for (const [productId, typeMapLevel] of productMap) {
            if (productsSelected.length && !productsSelected.includes(productId)) continue;

            for (const [typeId, entries] of typeMapLevel) {
                if (type.length && !type.includes(typeId)) continue;

                for (const e of entries) {
                    result.push({
                        date: e.date,
                        pays: countryMap.get(String(countryId))?.fr,
                        produit: produitMap[String(productId)],
                        type: typeMap[String(typeId)],
                        value: e.value,
                    });
                }
            }
        }
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}


function filterData(
    allData: { [key: string]: number[][] },
    {
        type,
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
    const monthToJSMonth: Record<number, number> = {
        //conversion de l'id en mois réel
        6: 0,
        11: 1,
        1: 2,
        12: 3,
        5: 4,
        10: 5,
        4: 6,
        8: 7,
        2: 8,
        3: 9,
        9: 10,
        7: 11,
    };

    const countryMap = new Map<string, Country>(Object.entries(pays));
    const typeMap: Record<string, string> = type_data;
    const produitMap: Record<string, string> = list_products;
    return Object.entries(allData) //il faut ajouter l'attribut year pour chaque année
        .flatMap(([year, yearData]) =>
            yearData.map((d: any) => ({
                ...d,
                year: +year, // ajoute l'année
            })),
        )
        .filter((d, i) => {
            const countryId = d[0];
            const typeId = d[1];
            const monthid = d[2];
            const productId = d[3];

            if (
                productsSelected.length &&
                !productsSelected.includes(productId)
            ) {
                return false;
            }

            if (
                countriesSelected.length &&
                !countriesSelected.includes(countryId)
            ) {
                return false;
            }

            if (type.length && !type.includes(typeId)) {
                return false;
            }

            if (monthid == 0) {
                //on vire le mois 0 qui correspond au total par an
                return false;
            }

            return true;
        })
        .map((d) => {
            // convertir le mois en objet Date
            const parsedDate = parseDateMonth(
                `${monthToJSMonth[d[2] as keyof typeof monthToJSMonth]} ${d.year}`,
            );

            return {
                date: parsedDate ?? new Date(0), // si parseDateMonth retourne null, on met 1er Jan 1970
                pays: countryMap.get(String(d[0]))?.fr,
                produit: produitMap[String(d[3])],
                type: typeMap[String(d[1])],
                value: +d[4],
            } as DataPoint;
        })

        .filter((d) => !isNaN(d.value))
        .sort((a: any, b: any) => a.date - b.date);
}

function filterevents(
    events: any[],
    map_icons: Record<string, any>,
    contrySelected: number[],
) {
    //données traités pour avoir les infos des icones
    const parseDate1 = d3.timeParse("%Y-%m-%d"); // parsing date pour les icones
    const parseDate2 = d3.timeParse("%Y-%m");
    const paysMap: Record<string, any> = pays;

    // construire la liste des valeurs possibles depuis la sélection
    const selectedValues = contrySelected.flatMap((id) => {
        const v = paysMap[id];
        if (!v) return [];
        return [v.code, v.en, v.fr, v.event_name].filter(Boolean);
    });
    const eventsWithIcons = events
        .map((event) => {
            // parse de la date

            const dateParsed = parseDate1(event.date_debut)
                ? parseDate1(event.date_debut)
                : parseDate2(event.date_debut)
                    ? parseDate2(event.date_debut)
                    : null;
            if (!dateParsed) return null;

            // catégorie / icône
            let category = "";
            let icon = null;
            let contry = null;
            if (event.categorie) {
                const typeList = event.categorie.split("/");
                category = typeList.find((t: any) => t in map_icons) || "";
                icon = map_icons[category] || null;
            } else {
                icon = map_icons[category] || null;
            }
            //filtrage par pays event.pays
            // valeurs du event (split + trim)
            const eventValues = event.pays.split("/").map((p: any) => p.trim());

            const filterContry = eventValues.some((ev: any) =>
                selectedValues.includes(ev),
            );
            if (!filterContry) return null;

            if (!icon) return null;
            const id = `icon-${category.toLowerCase().replace(/\s+/g, "-")}`;
            return {
                ...event, // on garde toutes les infos originales
                dateParsed, // date prête à l’emploi
                category, // catégorie finale
                id, //id associée
            };
        })
        .filter((d) => d !== null); // on enlève les events invalides
    return eventsWithIcons;
}

function flattenGroupedData3(groupedData: any[]) {
    //utilisé pour flatten un groupe avec 3 éléments
    console.time("flattenGroupedData3")
    const flattened: {
        symbol: string;
        type: any;
        zone: any;
        product: any;
        values: any;
    }[] = [];

    groupedData.forEach((d) => {
        d.values.forEach((productMap: any[], country: any) => {
            productMap.forEach((values, product) => {
                flattened.push({
                    symbol: `${country} - ${product} - ${d.symbol}`,
                    type: d.symbol,
                    zone: country,
                    product: product,
                    values: values,
                });
            });
        });
    });
    console.timeEnd("flattenGroupedData3")
    return flattened;
}

function cssSafe(str: string) {
    return str.replace(/[^a-zA-Z0-9_-]/g, "_");
};


function format_stacked_area_from_flatten(flatten: any[]) {
    return flatten.flatMap(stock =>
        stock.values.map((d: any) => ({
            date: new Date(d.date), // assure-toi que c'est un objet Date
            product: stock.product,
            type: stock.type.includes("Importation") ? "Importation" : "Exportation",
            value: +d.value
        }))
    );

}

function update_current_graphique(current_graph: RefObject<Number>, new_num: number, svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
    if (current_graph.current != new_num) {
        current_graph.current = new_num
        svg.selectAll("*").remove();
    }
}