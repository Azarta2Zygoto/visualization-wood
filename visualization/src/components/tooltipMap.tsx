"use client";

import Image from "next/image";
import { type JSX, useLayoutEffect, useMemo, useRef, useState } from "react";

import { hasFlag } from "country-flag-icons";

import type_data from "@/data/N027_LIB.json";
import month_names from "@/data/N053_LIB.json";
import countryConversion from "@/data/country_extended.json";

interface TooltipMapProps {
    appear: boolean;
    usefullData: {
        [key: string]: Record<keyof typeof type_data, number>;
    };
    year?: number;
    month?: number;
    country?: string;
    position: { x: number; y: number };
}

export default function TooltipMap({
    appear,
    usefullData,
    year,
    month,
    country,
    position: { x, y } = { x: 0, y: 0 },
}: TooltipMapProps): JSX.Element {
    // Smart positioning to prevent tooltip from going off-screen
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [currentPosition, setCurrentPosition] = useState<{
        x: number;
        y: number;
    }>({ x, y });

    const countryCode = Object.values(countryConversion).find(
        (c) => c.en === country || c.fr === country,
    )?.code;

    const values = useMemo(
        () => calculateData(usefullData, country),
        [usefullData, country],
    );

    useLayoutEffect(() => {
        if (!tooltipRef.current) return;

        const replaceDots = () => {
            if (!tooltipRef.current) return;

            const { width, height } =
                tooltipRef.current.getBoundingClientRect();
            const left =
                x + width > window.innerWidth ? x - width / 2 - 10 : x + 10;
            const top =
                y + height > window.innerHeight ? y - height - 10 : y + 20;
            setCurrentPosition({ x: left, y: top });
        };
        replaceDots();
    }, [x, y]);

    return (
        <div
            ref={tooltipRef}
            className="tooltip-map"
            style={{
                left: `${currentPosition.x}px`,
                top: `${currentPosition.y}px`,
                opacity: appear ? 1 : 0,
            }}
        >
            <div className="rows">
                {hasFlag(countryCode || "") && countryCode ? (
                    <Image
                        className="tooltip-country"
                        alt={country || ""}
                        aria-label={country}
                        width={32}
                        height={24}
                        src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode}.svg`}
                    />
                ) : null}
                <h3>
                    {country + " - "}
                    {month !== 0 &&
                        month_names[
                            month?.toString() as keyof typeof month_names
                        ] + " / "}
                    {year}
                </h3>
            </div>
            <ul>
                <li>
                    <strong>Export (euros): </strong>
                    {typeof values.export_euro === "number"
                        ? values.export_euro.toLocaleString("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                          })
                        : values.export_euro}
                </li>
                <li>
                    <strong>Import (euros): </strong>
                    {typeof values.import_euro === "number"
                        ? values.import_euro.toLocaleString("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                          })
                        : values.import_euro}
                </li>
                <li>
                    <strong>Trade balance (euros): </strong>
                    {typeof values.balance_euro === "number"
                        ? values.balance_euro.toLocaleString("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                          })
                        : values.balance_euro}
                </li>
                <li>
                    <strong>Export (tonnes): </strong>
                    {typeof values.export_tonnes === "number"
                        ? values.export_tonnes.toLocaleString("fr-FR")
                        : values.export_tonnes}
                </li>
                <li>
                    <strong>Import (tonnes): </strong>
                    {typeof values.import_tonnes === "number"
                        ? values.import_tonnes.toLocaleString("fr-FR")
                        : values.import_tonnes}
                </li>
            </ul>
        </div>
    );
}

function calculateData(
    usefullData: {
        [key: string]: Record<keyof typeof type_data, number>;
    },
    country?: string,
): {
    export_euro: number | string;
    import_euro: number | string;
    export_tonnes: number | string;
    import_tonnes: number | string;
    balance_euro: number | string;
} {
    if (!country)
        return {
            export_euro: "No data",
            import_euro: "No data",
            export_tonnes: "No data",
            import_tonnes: "No data",
            balance_euro: "No data",
        };

    const countryData = usefullData[country];
    const exportDataEuro = countryData["2"];
    const importDataEuro = countryData["3"];
    const exportTonnes = countryData["0"];
    const importTonnes = countryData["1"];
    const balanceDataEuro =
        exportDataEuro && importDataEuro
            ? exportDataEuro - importDataEuro
            : "No data";

    return {
        export_euro: exportDataEuro ?? "No data",
        import_euro: importDataEuro ?? "No data",
        export_tonnes: exportTonnes ?? "No data",
        import_tonnes: importTonnes ?? "No data",
        balance_euro: balanceDataEuro,
    };
}
