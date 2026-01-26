"use client";

import { type JSX, useEffect, useState } from "react";

import { WorldMap } from "@/components/map";
import { readNpz } from "@/utils/read";

export default function HomePage(): JSX.Element {
    const [values, setValues] = useState<number[][] | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const data = await readNpz(2020);
                setValues(data);
                console.log("Data loaded:", data);
            } catch (error) {
                console.error("Error loading data:", error);
            }
        }

        fetchData();
    }, []);

    return (
        <main>
            <h1>Welcome to the Visualization App</h1>
            {values ? (
                <div>
                    <h2>Data Preview:</h2>
                    <pre>{JSON.stringify(values.slice(0, 5), null, 2)}</pre>
                </div>
            ) : (
                <p>Loading data...</p>
            )}
            <WorldMap />
        </main>
    );
}
