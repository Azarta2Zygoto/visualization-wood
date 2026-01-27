"use client";

import { Fragment, type JSX, useEffect, useState } from "react";

import ConfigBar from "@/components/configBar";
import { WorldMap } from "@/components/map";
import metadata_app from "@/data/metadata.json";
import { readNpz } from "@/utils/read";

export default function HomePage(): JSX.Element {
    const [, setValues] = useState<{ [key: string]: number[][] }>({});

    useEffect(() => {
        async function fetchData(year: number) {
            try {
                const data = await readNpz(year);
                setValues((prev) => ({ ...prev, [year]: data }));
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
            <WorldMap />
            <main>
                <h1 className="title">Echanges internationaux de bois</h1>
            </main>
            <ConfigBar />
        </Fragment>
    );
}
