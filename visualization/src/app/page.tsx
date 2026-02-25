"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect, useState } from "react";

import Papa from "papaparse";

import ArrowUpDown from "@/components/ArrowUpDown";
import ParamBar from "@/components/ParamBar";
import ConfigBar from "@/components/configBar";
import Graphique from "@/components/d3/graphique";
import { WorldMap } from "@/components/d3/map";
import { InfoComponent } from "@/components/infoComponent";
import IntroComponent from "@/components/introComponent";
import Loading from "@/components/loading";
import metadata_app from "@/data/metadata.json";
import { SHOW_INTRO_STORAGE_KEY, type definitions } from "@/metadata/constants";
import type { ColorName, ProjectionName } from "@/metadata/types";
import { getAllChildren } from "@/utils/MODLecture";
import Icon from "@/utils/icon";
import { readNpz } from "@/utils/read";

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
        useState<ProjectionName>("geoNaturalEarth");
    const [IsStatic, setIsStatic] = useState<boolean>(false);
    const [NBCountryWithData, setNBCountryWithData] = useState<number>(0);
    const [AddAllYears, setAddAllYears] = useState<boolean>(false);
    const [paletteColor, setPaletteColor] = useState<ColorName>("orange");
    const [isDaltonian, setIsDaltonian] = useState<boolean>(false);
    const [isOpenInfo, setIsOpenInfo] = useState<boolean>(false);
    const [isOpenIntro, setIsOpenIntro] = useState<boolean>(false);
    const [isOpenIntroDefault, setIsOpenIntroDefault] = useState<boolean>(true);

    useEffect(() => {
        const storedOpenIntro = localStorage.getItem(SHOW_INTRO_STORAGE_KEY);

        if (storedOpenIntro !== null) {
            setIsOpenIntroDefault(storedOpenIntro === "true");
            setIsOpenIntro(storedOpenIntro === "true");
        } else {
            setIsOpenIntro(true);
        }
    }, []);

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
            if (allData[year]) {
                if (
                    AddAllYears &&
                    year < metadata_app.bois.end_year &&
                    Object.keys(allData).length !==
                        metadata_app.bois.end_year -
                            metadata_app.bois.start_year +
                            1
                ) {
                    fetchData(year + 1);
                }
                return;
            }

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
                if (AddAllYears && year < metadata_app.bois.end_year)
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

        fetchData(AddAllYears ? metadata_app.bois.start_year : currentYear);
    }, [currentYear, AddAllYears]);

    function openIntro() {
        setIsOpenIntro(true);
        setIsOpenInfo(false);
    }

    return (
        <Fragment>
            <h1 className="title">{t("title")}</h1>
            <button
                className="btn btn-param"
                type="button"
                aria-label={t("parameters-desc")}
                title={t("parameters-desc")}
                onClick={() => setIsOpenParamBar((prev) => !prev)}
            >
                {t("parameters")}
            </button>
            <button
                className="btn btn-info"
                type="button"
                aria-label={t("info-desc")}
                title={t("info-desc")}
                onClick={() => setIsOpenInfo((prev) => !prev)}
            >
                <Icon
                    name="info-circle-fill"
                    size={20}
                />
            </button>

            <ParamBar
                isOpen={isOpenParamBar}
                mapDefinition={mapDefinition}
                geoProjection={geoProjection}
                isStatic={IsStatic}
                isDaltonian={isDaltonian}
                paletteColor={paletteColor}
                onClose={() => setIsOpenParamBar(false)}
                setMapDefinition={setMapDefinition}
                setGeoProjection={setGeoProjection}
                setIsStatic={setIsStatic}
                setIsDaltonian={setIsDaltonian}
                setPaletteColor={setPaletteColor}
            />

            <WorldMap
                rawData={allData}
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
                isStatic={IsStatic}
                isDaltonian={isDaltonian}
                paletteColor={paletteColor}
                setCountriesSelected={setCountriesSelected}
                setNBCountryWithData={setNBCountryWithData}
            />

            <ConfigBar
                typeData={typeData}
                currentYear={currentYear}
                currentMonth={currentMonth}
                isMultipleMode={isMultipleMode}
                isCountryMode={isCountryMode}
                isAbsolute={isAbsolute}
                productsSelected={productsSelected}
                NBCountryWithData={NBCountryWithData}
                countriesSelected={countriesSelected}
                isAllDataLoaded={
                    Object.keys(allData).length ===
                    metadata_app.bois.end_year -
                        metadata_app.bois.start_year +
                        1
                }
                setTypeData={setTypeData}
                setCurrentYear={setCurrentYear}
                setCurrentMonth={setCurrentMonth}
                setProductsSelected={setProductsSelected}
                setCountriesSelected={setCountriesSelected}
                setIsMultipleMode={setIsMultipleMode}
                setIsCountryMode={setIsCountryMode}
                setIconSelected={setIconSelected}
                setIsAbsolute={setIsAbsolute}
                setGetAllData={() => setAddAllYears(true)}
            />
            <ArrowUpDown />
            <Loading yearLoading={loadingYears} />
            <Graphique
                allData={allData}
                type={[typeData]}
                productsSelected={
                    productsSelected.length === 0
                        ? [0]
                        : productsSelected.length === 1
                          ? getAllChildren(productsSelected[0]).length > 0
                              ? getAllChildren(productsSelected[0])
                              : productsSelected
                          : productsSelected
                }
                countriesSelected={
                    countriesSelected.length === 0 ? [21] : countriesSelected
                }
                iconSelected={iconSelected}
                allEvents={allEvents}
            />
            <InfoComponent
                isOpen={isOpenInfo}
                onClose={() => setIsOpenInfo(false)}
                onOpenIntro={openIntro}
            />
            <IntroComponent
                isOpen={isOpenIntro}
                isOpenDefault={isOpenIntroDefault}
                onClose={() => setIsOpenIntro(false)}
                setShowIntro={setIsOpenIntroDefault}
            />
        </Fragment>
    );
}
