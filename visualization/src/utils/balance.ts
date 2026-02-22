import pays from "@/data/country_extended.json";

interface MakeBalanceProps {
    lectureData: {
        [key: string]: Record<string, number>;
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

export function MakeBalance({
    lectureData,
    countries,
    continent,
    isAbsolute,
}: MakeBalanceProps): {
    countryName: string;
    value: number;
    x: number;
    y: number;
}[] {
    const balanceData: {
        countryName: string;
        value: number;
        x: number;
        y: number;
    }[] = [];

    if (countries) {
        countries.forEach((country) => {
            if (!lectureData[country.countryName]) return; // Skip if no data for the country

            const valueExport = lectureData[country.countryName][2] || 0;
            const valueImport = lectureData[country.countryName][3] || 0;

            if (valueExport === 0 || valueImport === 0) return; // Skip countries with no data

            const balance = isAbsolute
                ? valueExport - valueImport
                : (valueExport - valueImport) / (valueExport + valueImport); // Calculate balance as a percentage of exports
            balanceData.push({
                countryName: country.countryName,
                value: balance,
                x: country.x,
                y: country.y,
            });
        });
        return balanceData;
    } else if (continent) {
        Object.entries(continent).forEach(([cont, values]) => {
            const countryCode = Object.keys(pays).find(
                (key) => pays[key as keyof typeof pays].code === cont,
            );
            const countryName =
                pays[countryCode as keyof typeof pays]?.en || cont;

            const valueExport = lectureData[countryName]?.[2] || 0;
            const valueImport = lectureData[countryName]?.[3] || 0;

            if (valueExport === 0 || valueImport === 0) return; // Skip countries with no data
            const balance = isAbsolute
                ? valueExport - valueImport
                : (valueExport - valueImport) / (valueExport + valueImport); // Calculate balance as a percentage of exports

            balanceData.push({
                countryName,
                value: balance,
                x: values.center[0],
                y: values.center[1],
            });
        });

        return balanceData;
    }

    return [];
}
