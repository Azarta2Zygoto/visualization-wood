import pays from "@/data/countries.json";

const pays_english = new Set(Object.values(pays).map((country) => country.en));

/** Checks if a country is known based on the provided name and mode (country or region).
 * In country mode, it checks against a set of known English country names.
 * In region mode, it assumes all names are valid since regions can be more flexible.
 * @param country - The name of the country or region to check.
 * @param isCountryMode - A boolean indicating whether to check in country mode (true) or region mode (false).
 * @returns A boolean indicating whether the provided name is a known country (in country mode) or valid (in region mode).
 */

export function isKnownCountry(
    country: string | undefined,
    isCountryMode: boolean,
): boolean {
    if (!country) return false;
    return isCountryMode ? pays_english.has(country) : true;
}

/**
 *  Scales a base value by a given scale factor raised to an exponent, while ensuring the result does not exceed a specified maximum or fall below the base value.
 * @param base - The initial value to be scaled.
 * @param max - The maximum allowed value after scaling.
 * @param scale - The factor by which to scale the base value.
 * @param exp - The exponent to which the scale factor is raised, allowing for non-linear scaling.
 */

export function clampedScale(
    base: number,
    max: number,
    scale: number,
    exp: number,
): number {
    return Math.max(Math.min(base * scale ** exp, max), base);
}
