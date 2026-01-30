"use client";

import { Fragment, type JSX, useEffect, useState } from "react";

import ConfigBar from "@/components/configBar";
import { WorldMap } from "@/components/map";
import metadata_app from "@/data/metadata.json";
import { readNpz } from "@/utils/read";

export default function HomePage(): JSX.Element {
    const [allData, setAllData] = useState<{ [key: string]: number[][] }>({});
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
