import * as d3 from "d3";

export const projections = [
    { name: "geoEqualEarth", value: d3.geoEqualEarth, drag: false },
    { name: "geoNaturalEarth", value: d3.geoNaturalEarth1, drag: false },
    { name: "geoMercator", value: d3.geoMercator, drag: false },
    { name: "geoOrthographic", value: d3.geoOrthographic, drag: true },
] as const;
