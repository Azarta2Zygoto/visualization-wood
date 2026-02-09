"use client";

import { Fragment, type JSX, useEffect, useState } from "react";
import Papa from "papaparse";

import ConfigBar from "@/components/configBar";
import { WorldMap } from "@/components/map";
import Graphique from "@/components/graphique";
import metadata_app from "@/data/metadata.json";
import { readNpz } from "@/utils/read";

export default function HomePage(): JSX.Element {
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
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // 🔹 Charger le CSV une seule fois
    useEffect(() => {
        console.log("🔹 CSV useEffect monté");
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
                console.log(`📝 CSV chargé, longueur=${csvText.length} caractères`);

                // Parser le CSV avec PapaParse
                Papa.parse(csvText, {
                    header: true,             // première ligne = noms de colonnes
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    complete: (result: any) => {
                        console.log(`✅ CSV parsé, ${result.data.length} lignes`);
                        setAllEvents(result.data);
                    },
                    error: (err: any) => {
                        console.error("❌ Erreur PapaParse:", err);
                    }
                });
            })
            .catch((err) => {
                console.error("❌ Fetch CSV échoué:", err);
            });
    }, []);

    // Lazy load data only for the current year
    useEffect(() => {
        async function fetchData(year: number) {
            // Check if data is already loaded
            if (allData[year]) {
                return;
            }

            setIsLoading(true);
            try {
                const data = await readNpz(year);
                // Only keep current year data to prevent memory buildup
                setAllData({ [year]: data });
                console.log(`Data loaded for year ${year}`);
            } catch (error) {
                console.error(`Error loading data for year ${year}:`, error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData(currentYear);
    }, [currentYear]);

    return (
        <Fragment>

            <WorldMap
                allData={allData}
                type={typeData}
                year={currentYear}
                month={currentMonth}
                productsSelected={productsSelected}
                countriesSelected={countriesSelected}
                isMultipleMode={isMultipleMode}
            />


            <Graphique
                allData={allData}
                type={[typeData]} //ya que 1 seul nombre pour le moment
                productsSelected={productsSelected}
                countriesSelected={countriesSelected}
                iconSelected={["Politique", "Économie", "Géopolitique"]}
                all_events={allEvents}
            />

            <main>
                <h1 className="title">Echanges internationaux de bois</h1>
            </main>
            <ConfigBar
                typeData={typeData}
                currentYear={currentYear}
                currentMonth={currentMonth}
                productsSelected={productsSelected}
                countriesSelected={countriesSelected}
                isMultipleMode={isMultipleMode}
                setTypeData={setTypeData}
                setCurrentYear={setCurrentYear}
                setCurrentMonth={setCurrentMonth}
                setProductsSelected={setProductsSelected}
                setCountriesSelected={setCountriesSelected}
                setIsMultipleMode={setIsMultipleMode}
            />
        </Fragment>
    );
}
