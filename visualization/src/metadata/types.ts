import type { MultiPolygon } from "geojson";

import colors from "@/data/colors.json";
import country from "@/data/countries.json";
import products from "@/data/products.json";
import { projections } from "@/metadata/geoprojections";

export interface CountryData {
    type: string;
    properties: {
        name: string;
    };
    geometry: MultiPolygon;
}

export type CountryType = keyof typeof country;
export type ProductType = keyof typeof products;
export type ColorName = keyof typeof colors;
export type ProjectionName = (typeof projections)[number]["name"];
