import type { MultiPolygon } from "geojson";

export interface CountryData {
    type: string;
    properties: {
        name: string;
    };
    geometry: MultiPolygon;
}

export type Themes = "light" | "dark";
