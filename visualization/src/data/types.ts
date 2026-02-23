import type { MultiPolygon } from "geojson";

import country from "@/data/country.json";
import products from "@/data/products.json";

export interface CountryData {
    type: string;
    properties: {
        name: string;
    };
    geometry: MultiPolygon;
}

export type CountryType = keyof typeof country;
export type ProductType = keyof typeof products;
