"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { type JSX, useLayoutEffect, useMemo, useRef, useState } from "react";

import { hasFlag } from "country-flag-icons";

import ClevellandDotChart from "@/components/d3/cleveland_dot_chart";
import { useGlobal } from "@/components/globalProvider";
import pays from "@/data/countries.json";
import month_names from "@/data/months.json";
import type { CountryType } from "@/metadata/types";

const defaultNoData = -1;
const AllNoData = {
    export_euro: defaultNoData,
    import_euro: defaultNoData,
    export_tonnes: defaultNoData,
    import_tonnes: defaultNoData,
    balance_euro: defaultNoData,
};

interface TooltipMapProps {
    appear: boolean;
    countriesValues: {
        [key: string]: Record<number, number>;
    };
    year: number;
    month: number;
    country: CountryType;
    position: { x: number; y: number };
    rawData?: { [key: string]: number[][] };
    productsSelected?: number[];
    countryNumberToName?: Map<number, string>;
}

export default function TooltipMap({
    appear,
    countriesValues,
    year,
    month,
    country,
    position: { x, y } = { x: 0, y: 0 },
    rawData,
    productsSelected = [],
    countryNumberToName,
}: TooltipMapProps): JSX.Element {
    const t = useTranslations("Tooltip");
    const { windowSize, locale } = useGlobal();

    const tooltipRef = useRef<HTMLDivElement>(null);
    const [currentPosition, setCurrentPosition] = useState<{
        x: number;
        y: number;
    }>({ x, y });

    const values = useMemo(
        () => calculateData(countriesValues, pays[country].en),
        [countriesValues, country],
    );

    // J'ai pas compris mais le chat a réussi à transformer correctement les données
    // Calculate Cleveland dot chart data
    const chartData = useMemo(() => {
        if (
            !rawData ||
            !rawData[year] ||
            !countryNumberToName ||
            productsSelected.length === 0
        ) {
            return [];
        }

        const yearData = rawData[year];
        const countryName = pays[country].en;
        const chartDataByProduct: Record<
            number,
            { export: number; import: number }
        > = {};

        // Get country number from the map
        let countryNumber: number | null = null;
        for (const [num, name] of countryNumberToName.entries()) {
            if (name === countryName) {
                countryNumber = num;
                break;
            }
        }

        if (countryNumber === null) return [];

        const productsSet = new Set(productsSelected);

        // Aggregate data by product
        for (let i = 0; i < yearData.length; i++) {
            const entry = yearData[i];

            // Check month and country match
            if (entry[2] !== month || entry[0] !== countryNumber) continue;

            // Check product match
            const productIndex = entry[3];
            if (!productsSet.has(productIndex)) continue;

            const typeIndex = entry[1];
            const value = entry[4] || 0;

            if (!chartDataByProduct[productIndex]) {
                chartDataByProduct[productIndex] = { export: 0, import: 0 };
            }

            // typeIndex: 0=export_tonnes, 1=import_tonnes, 2=export_euro, 3=import_euro
            // On prend que les valeurs en euro
            if (typeIndex === 2) {
                chartDataByProduct[productIndex].export += value;
            } else if (typeIndex === 3) {
                chartDataByProduct[productIndex].import += value;
            }
        }

        // Convert to chart format
        return Object.entries(chartDataByProduct).map(
            ([productIndex, values]) => ({
                productIndex: parseInt(productIndex),
                exportValue: values.export,
                importValue: values.import,
            }),
        );
    }, [rawData, year, month, country, productsSelected, countryNumberToName]);

    useLayoutEffect(() => {
        if (!tooltipRef.current) return;

        const replaceDots = () => {
            if (!tooltipRef.current) return;

            const { width, height } =
                tooltipRef.current.getBoundingClientRect();
            const left =
                x + width + 10 > windowSize.width
                    ? windowSize.width - width / 2 - 10
                    : x < width / 2
                      ? width / 2 + 10
                      : x;

            const top =
                y + height + 10 > windowSize.height
                    ? Math.min(y, windowSize.height) - height - 10
                    : y + 20;
            setCurrentPosition({ x: left, y: top });
        };

        replaceDots();
    }, [windowSize.height, windowSize.width, x, y]);

    return (
        <div
            ref={tooltipRef}
            className="tooltip-map"
            role="tooltip"
            aria-hidden={!appear}
            style={{
                left: `${currentPosition.x}px`,
                top: `${currentPosition.y}px`,
                opacity: appear ? 1 : 0,
            }}
        >
            <div className="rows">
                {hasFlag(pays[country].code) && (
                    <Image
                        className="tooltip-country"
                        alt={t("flag", {
                            country: pays[country][locale],
                        })}
                        aria-label={t("flag", {
                            country: pays[country][locale],
                        })}
                        width={32}
                        height={24}
                        src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${pays[country].code}.svg`}
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                )}
                {pays[country].fr === "France" ? (
                    <h3>{pays[country][locale]}</h3>
                ) : (
                    <h3>
                        {pays[country][locale] + " - "}
                        {month !== 0 &&
                            t(
                                month_names[
                                    month.toString() as keyof typeof month_names
                                ],
                            ) + " / "}
                        {year}
                    </h3>
                )}
            </div>
            {pays[country].fr === "France" ? (
                <p className="france-tooltip">{t("france-tooltip")}</p>
            ) : values.export_euro +
                  values.export_tonnes +
                  values.import_euro +
                  values.import_tonnes ===
              4 * defaultNoData ? (
                <p>{t("no-data")}</p>
            ) : (
                <div className="tooltip-content">
                    {chartData.length > 0 && (
                        <div className="tooltip-chart">
                            <ClevellandDotChart
                                data={chartData}
                                width={260}
                                height={250}
                            />
                        </div>
                    )}
                    <div className="tooltip-text">
                        <ul>
                            {Object.keys(values).map((key) => {
                                return (
                                    <li key={key}>
                                        <strong>
                                            {t(key, {
                                                value: values[
                                                    key as keyof typeof values
                                                ],
                                            })}
                                        </strong>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

function calculateData(
    countriesValues: {
        [key: string]: Record<number, number>;
    },
    countryname: string,
): {
    export_euro: number;
    import_euro: number;
    export_tonnes: number;
    import_tonnes: number;
    balance_euro: number;
} {
    const countryData = countriesValues[countryname];
    if (!countryData) return AllNoData;

    const exportDataEuro = countryData[2];
    const importDataEuro = countryData[3];
    const exportTonnes = countryData[0];
    const importTonnes = countryData[1];
    const balanceDataEuro =
        exportDataEuro && importDataEuro
            ? exportDataEuro - importDataEuro
            : defaultNoData;

    return {
        export_euro: exportDataEuro ?? defaultNoData,
        import_euro: importDataEuro ?? defaultNoData,
        export_tonnes: exportTonnes ?? defaultNoData,
        import_tonnes: importTonnes ?? defaultNoData,
        balance_euro: balanceDataEuro,
    };
}
