import pays from "@/data/countries.json";
import { CountryType } from "@/metadata/types";

interface MakeBalanceProps {
    lectureData: {
        [key: string]: Record<number, number>;
    };
    countries?: {
        countryName: string;
        x: number;
        y: number;
    }[];
    continent?: Record<
        string,
        {
            center: number[];
            countries: Record<string, { fr: string; en: string }>;
        }
    >;
    isAbsolute: boolean;
}

interface BalanceData {
    countryName: string;
    value: number;
    x: number;
    y: number;
}

export function MakeBalance({
    lectureData,
    countries,
    continent,
    isAbsolute,
}: MakeBalanceProps): BalanceData[] {
    if (!countries && !continent) {
        throw new Error("Either countries or continent data must be provided.");
    }

    if (countries) {
        return countries
            .map((country) => {
                const data = lectureData[country.countryName];
                if (!data) return; // Skip if no data for the country

                const valueExport = data[2];
                const valueImport = data[3];

                if (valueExport === undefined || valueImport === undefined)
                    return; // Skip countries with no data

                const balance = calculateBalance(
                    valueExport,
                    valueImport,
                    isAbsolute,
                );
                return {
                    countryName: country.countryName,
                    value: balance,
                    x: country.x,
                    y: country.y,
                };
            })
            .filter((item): item is BalanceData => !!item); // Filter out undefined items
    } else if (continent) {
        return Object.entries(continent)
            .map(([cont, values]) => {
                const countryCode = Object.keys(pays).find(
                    (key) => pays[key as CountryType].code === cont,
                );
                const countryName =
                    pays[countryCode as CountryType]?.en || cont;

                const valueExport = lectureData[countryName][2];
                const valueImport = lectureData[countryName][3];

                if (valueExport === undefined || valueImport === undefined)
                    return; // Skip countries with no data
                const balance = calculateBalance(
                    valueExport,
                    valueImport,
                    isAbsolute,
                );

                return {
                    countryName,
                    value: balance,
                    x: values.center[0],
                    y: values.center[1],
                };
            })
            .filter((item): item is BalanceData => !!item); // Filter out undefined items;
    }

    return [];
}

// Helper to calculate balance value
function calculateBalance(
    valueExport: number,
    valueImport: number,
    isAbsolute: boolean,
): number {
    if (isAbsolute) {
        return valueExport - valueImport;
    } else {
        // Avoid division by zero
        const denom = valueExport + valueImport;
        return denom === 0 ? 0 : (valueExport - valueImport) / denom;
    }
}
