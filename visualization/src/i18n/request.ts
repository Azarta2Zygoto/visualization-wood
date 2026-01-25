import type { Formats } from "next-intl";
import { getRequestConfig } from "next-intl/server";

export const formats = {
    number: {
        euro: {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 2,
        },
    },
} satisfies Formats;

export default getRequestConfig(async () => {
    const defaultLocale = "fr";

    return {
        locale: defaultLocale,
        messages: (await import(`../../messages/${defaultLocale}.json`))
            .default,
        formats,
        timeZone: "Europe/Paris",
    };
});
