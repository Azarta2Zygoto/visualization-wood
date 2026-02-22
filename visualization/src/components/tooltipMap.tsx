"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { type JSX, useLayoutEffect, useMemo, useRef, useState } from "react";

import { hasFlag } from "country-flag-icons";

import type_data from "@/data/N027_LIB.json";
import month_names from "@/data/N053_LIB.json";
import countryConversion from "@/data/country_extended.json";

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
    const t = useTranslations("Tooltip");
    const { windowSize, locale } = useGlobal();

    const tooltipRef = useRef<HTMLDivElement>(null);
    const [currentPosition, setCurrentPosition] = useState<{
        x: number;
        y: number;
    }>({ x, y });

    const countryValue = Object.values(countryConversion).find(
        (c) => c.en === country || c.fr === country,
    );

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
            style={{
                left: `${currentPosition.x}px`,
                top: `${currentPosition.y}px`,
                opacity: appear ? 1 : 0,
            }}
        >
            <div className="rows">
                {hasFlag(countryValue?.code || "") && countryValue?.code ? (
                    <Image
                        className="tooltip-country"
                        alt={t("flag", {
                            country:
                                locale === "en"
                                    ? countryValue?.en
                                    : countryValue?.fr || "unknown",
                        })}
                        aria-label={t("flag", {
                            country:
                                locale === "en"
                                    ? countryValue?.en
                                    : countryValue?.fr || "unknown",
                        })}
                        width={32}
                        height={24}
                        src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryValue?.code}.svg`}
                    />
                ) : null}
                <h3>
                    {locale === "en"
                        ? countryValue?.en + " - "
                        : countryValue?.fr + " - "}
                    {month !== 0 &&
                        month_names[
                            month?.toString() as keyof typeof month_names
                        ] + " / "}
                    {year}
                </h3>
            </div>
            {JSON.stringify(values) === JSON.stringify(AllNoData) ? (
                <p>{t("no-data")}</p>
            ) : (
                <ul>
                    <li>
                        <strong>
                            {t("export-euro", { value: values.export_euro })}
                        </strong>
                    </li>
                    <li>
                        <strong>
                            {t("import-euro", { value: values.import_euro })}
                        </strong>
                    </li>
                    <li>
                        <strong>
                            {t("balance-euro", { value: values.balance_euro })}
                        </strong>
                    </li>
                    <li>
                        <strong>
                            {t("export-ton", { value: values.export_tonnes })}
                        </strong>
                    </li>
                    <li>
                        <strong>
                            {t("import-ton", { value: values.import_tonnes })}
                        </strong>
                    </li>
                </ul>
            )}
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
    if (!country) return AllNoData;

    const countryData = usefullData[country];
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
