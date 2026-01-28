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

    useEffect(() => {
        async function fetchData(year: number) {
            try {
                const data = await readNpz(year);
                setAllData((prev) => ({ ...prev, [year]: data }));
                console.log("Data loaded:", data);
                // You can add more logic here to handle the loaded data
            } catch (error) {
                console.error("Error loading data:", error);
            }
        }

        fetchData(metadata_app.bois.start_year);
    }, []);

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
            <ConfigBar />
        </Fragment>
    );
}
