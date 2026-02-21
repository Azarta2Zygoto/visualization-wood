/**
 * Application-wide constants for paths, asset names, and configuration values
 */

// ============================================================================
// ASSET PATHS (Images and Static Files)
// ============================================================================

/**
 * Image asset filenames used throughout the application
 * All images are referenced relative to the public folder with this base path prefix
 */
export const ASSETS = {
    IMAGES: {
        LOGO: "logo.png",
    },
} as const;

// ============================================================================
// PATH FORMATTING
// ============================================================================

/**
 * Utility for building locale-prefixed paths
 * @param locale - The current locale (e.g., 'en', 'fr')
 * @param route - The route path (e.g., '/projects', '/study')
 * @returns A complete locale-prefixed path (e.g., '/en/projects')
 *
 * @example
 * buildLocalePath('en', '/projects') // Returns: '/en/projects'
 * buildLocalePath('fr', '/') // Returns: '/fr/'
 */
export const buildLocalePath = (locale: string, route: string): string => {
    const normalizedRoute = route.replace(/^\/|\/$/g, "");
    return normalizedRoute ? `/${locale}/${normalizedRoute}` : `/${locale}`;
};

/**
 * Utility for building asset paths with base path prefix
 * @param assetName - Name of the asset (e.g., 'logo.svg', 'photo.jpg')
 * @param basePath - The base path prefix (e.g., '/profile/', '/')
 * @returns Complete asset path ready for image src attributes
 *
 * @example
 * buildAssetPath('logo.svg', '/profile/') // Returns: '/profile/logo.svg'
 * buildAssetPath('photo.jpg', '/') // Returns: '/photo.jpg'
 */
export const buildAssetPath = (assetName: string, basePath: string): string => {
    return basePath + assetName;
};

// ============================================================================
// Configurations
// ============================================================================

/**
 * Valid values for the application
 */
export const THEME_VALUES = {
    LIGHT: "light",
    DARK: "dark",
} as const;

export const LOCALES = {
    ENGLISH: "en",
    FRENCH: "fr",
} as const;

export const MAP_DEFINITIONS = {
    low: "110m",
    medium: "50m",
    high: "10m",
} as const;

/**
 * Valid types for the application
 */

export type definitions = keyof typeof MAP_DEFINITIONS;

/**
 * Default value when no user preference is stored
 */
export const DEFAULT_THEME = THEME_VALUES.LIGHT;
export const DEFAULT_LOCALE = LOCALES.FRENCH;

/**
 * CSS selector for theme attribute on document root
 */
export const THEME_ATTRIBUTE = "data-theme";

/**
 * LocalStorage key for persisting user preference
 */
export const THEME_STORAGE_KEY = "theme";
export const LOCALE_STORAGE_KEY = "locale";
export const MAP_DEFINITION_STORAGE_KEY = "mapDefinition";
export const GEO_PROJECTION_STORAGE_KEY = "geoProjection";
