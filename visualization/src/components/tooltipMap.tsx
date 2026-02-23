"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { type JSX, useLayoutEffect, useMemo, useRef, useState } from "react";

import { hasFlag } from "country-flag-icons";

import pays from "@/data/countries.json";
import type_data from "@/data/exports.json";
import month_names from "@/data/months.json";
import type { CountryType } from "@/metadata/types";

import { useGlobal } from "./globalProvider";

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
    usefullData: {
        [key: string]: Record<keyof typeof type_data, number>;
    };
    year: number;
    month: number;
    country: CountryType;
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
    const t = useTranslations("Tooltip");
    const { windowSize, locale } = useGlobal();

    const tooltipRef = useRef<HTMLDivElement>(null);
    const [currentPosition, setCurrentPosition] = useState<{
        x: number;
        y: number;
    }>({ x, y });

    const values = useMemo(
        () => calculateData(usefullData, pays[country].en),
        [usefullData, country],
    );

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
                            month_names[
                                month.toString() as keyof typeof month_names
                            ] + " / "}
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
            )}
        </div>
    );
}

function calculateData(
    usefullData: {
        [key: string]: Record<keyof typeof type_data, number>;
    },
    countryname: string,
): {
    export_euro: number;
    import_euro: number;
    export_tonnes: number;
    import_tonnes: number;
    balance_euro: number;
} {
    const countryData = usefullData[countryname];
    if (!countryData) return AllNoData;

    const exportDataEuro = countryData["2"];
    const importDataEuro = countryData["3"];
    const exportTonnes = countryData["0"];
    const importTonnes = countryData["1"];
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
