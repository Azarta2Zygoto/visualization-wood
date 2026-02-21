"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect, useState } from "react";

import Papa from "papaparse";

import ArrowUpDown from "@/components/ArrowUpDown";
import ParamBar from "@/components/ParamBar";
import ConfigBar from "@/components/configBar";
import Graphique from "@/components/graphique";
import Loading from "@/components/loading";
import { WorldMap } from "@/components/map";
import { type definitions } from "@/data/constants";
import metadata_app from "@/data/metadata.json";
import { readNpz } from "@/utils/read";

const adding_automatic_all_years = false; // Permet de charger les années les unes après les autres ou à chaque demande

export default function HomePage(): JSX.Element {
    const t = useTranslations("HomePage");

    const [allData, setAllData] = useState<{ [key: string]: number[][] }>({});
    const [allEvents, setAllEvents] = useState<any[]>([]);
    const [typeData, setTypeData] = useState<number>(0);
    const [currentYear, setCurrentYear] = useState<number>(
        metadata_app.bois.start_year,
    );
    const [currentMonth, setCurrentMonth] = useState<number>(
        metadata_app.bois.start_month ?? 0,
    );
    const [productsSelected, setProductsSelected] = useState<number[]>([0]);
    const [countriesSelected, setCountriesSelected] = useState<number[]>([]);
    const [isMultipleMode, setIsMultipleMode] = useState<boolean>(false);
    const [isCountryMode, setIsCountryMode] = useState<boolean>(true);
    const [loadingYears, setLoadingYears] = useState<Set<number>>(new Set());
    const [iconSelected, setIconSelected] = useState<string[]>([]);
    const [isOpenParamBar, setIsOpenParamBar] = useState<boolean>(false);
    const [mapDefinition, setMapDefinition] = useState<definitions>("low");
    const [isAbsolute, setIsAbsolute] = useState<boolean>(false);
    const [geoProjection, setGeoProjection] =
        useState<string>("geoNaturalEarth");

    // 🔹 Charger le CSV une seule fois
    useEffect(() => {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const url = `${basePath}/data/all_event_wood.csv`;

        fetch(url)
            .then((res) => {
                console.log(`📥 Fetch terminé, status=${res.status}`);
                if (!res.ok) {
                    throw new Error(`Impossible de charger le CSV à ${url}`);
                }
                return res.text();
            })
            .then((csvText) => {
                console.log(
                    `📝 CSV chargé, longueur=${csvText.length} caractères`,
                );

                // Parser le CSV avec PapaParse
                Papa.parse(csvText, {
                    worker: true, // utiliser un worker pour ne pas bloquer le thread principal
                    header: true, // première ligne = noms de colonnes
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    complete: (result: any) => {
                        console.log(
                            `✅ CSV parsé, ${result.data.length} lignes`,
                        );
                        setAllEvents(result.data);
                    },
                    error: (err: any) => {
                        console.error("❌ Erreur PapaParse:", err);
                    },
                });
            })
            .catch((err) => {
                console.error("❌ Fetch CSV échoué:", err);
            });
    }, []);

    useEffect(() => {
        async function fetchData(year: number) {
            if (allData[year]) return;

            setLoadingYears((prev) => new Set(prev).add(year));
            try {
                const data = await readNpz(year);

                // Add the new data to the existing allData state
                setAllData((prevData) => ({
                    ...prevData,
                    [year]: data,
                }));
                console.log(`Data loaded for year ${year}`);

                // Ajout automatique de toutes les données de toute sles années
                if (
                    adding_automatic_all_years &&
                    year < metadata_app.bois.end_year
                )
                    fetchData(year + 1);
            } catch (error) {
                console.error(`Error loading data for year ${year}:`, error);
            } finally {
                setLoadingYears((prev) => {
                    const next = new Set(prev);
                    next.delete(year);
                    return next;
                });
            }
        }

        fetchData(currentYear);
    }, [currentYear]);

    return (
        <Fragment>
            <h1 className="title">{t("title")}</h1>
            <button
                className="btn btn-param"
                type="button"
                aria-label={t("parameters")}
                title={t("parameters")}
                onClick={() => setIsOpenParamBar((prev) => !prev)}
            >
                {isOpenParamBar ? "×" : "⚙️"}
            </button>

            <ParamBar
                open={isOpenParamBar}
                mapDefinition={mapDefinition}
                geoProjection={geoProjection}
                setOpen={setIsOpenParamBar}
                setMapDefinition={setMapDefinition}
                setGeoProjection={setGeoProjection}
            />

            <WorldMap
                allData={allData}
                type={typeData}
                year={currentYear}
                month={currentMonth}
                productsSelected={productsSelected}
                countriesSelected={countriesSelected}
                isMultipleMode={isMultipleMode}
                isCountryMode={isCountryMode}
                mapDefinition={mapDefinition}
                isAbsolute={isAbsolute}
                geoProjection={geoProjection}
                setCountriesSelected={setCountriesSelected}
            />

            <ConfigBar
                typeData={typeData}
                currentYear={currentYear}
                currentMonth={currentMonth}
                isMultipleMode={isMultipleMode}
                isCountryMode={isCountryMode}
                isAbsolute={isAbsolute}
                productsSelected={productsSelected}
                setTypeData={setTypeData}
                setCurrentYear={setCurrentYear}
                setCurrentMonth={setCurrentMonth}
                setProductsSelected={setProductsSelected}
                setCountriesSelected={setCountriesSelected}
                setIsMultipleMode={setIsMultipleMode}
                setIsCountryMode={setIsCountryMode}
                setIconSelected={setIconSelected}
                setIsAbsolute={setIsAbsolute}
            />
            <ArrowUpDown />
            <Loading yearLoading={loadingYears} />
            {/**<Graphique
                allData={allData}
                type={[typeData]}
                productsSelected={productsSelected}
                countriesSelected={countriesSelected}
                iconSelected={iconSelected}
                allEvents={allEvents}
            />
                */}
        </Fragment>
    );
}
