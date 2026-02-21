"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect } from "react";

import {
    GEO_PROJECTION_STORAGE_KEY,
    IS_STATIC_STORAGE_KEY,
    MAP_DEFINITIONS,
    MAP_DEFINITION_STORAGE_KEY,
    definitions,
} from "@/data/constants";
import { type ProjectionName, projections } from "@/data/geoprojection";

import { useGlobal } from "./globalProvider";
import Checkbox from "./personal/checkbox";
import FlagSelectMenu from "./personal/flagSelectMenu";
import SelectMenu from "./personal/selectMenu";
import ThemeSwitch from "./personal/themeSwitch";

interface ParamBarProps {
    open: boolean;
    mapDefinition: definitions;
    geoProjection: string;
    isStatic: boolean;
    setOpen: (open: boolean) => void;
    setMapDefinition: (definition: definitions) => void;
    setGeoProjection: (projection: string) => void;
    setIsStatic: (isStatic: boolean) => void;
}

export default function ParamBar({
    open,
    mapDefinition,
    geoProjection,
    isStatic,
    setOpen,
    setMapDefinition,
    setGeoProjection,
    setIsStatic,
}: ParamBarProps): JSX.Element {
    const t = useTranslations("ParamBar");

    const { locale } = useGlobal();

    function handleDefinitionChange(definition: string) {
        setMapDefinition(definition as definitions);
        localStorage.setItem(MAP_DEFINITION_STORAGE_KEY, definition);
    }

    function handleProjectionChange(projection: string) {
        setGeoProjection(projection);
        localStorage.setItem(GEO_PROJECTION_STORAGE_KEY, projection);
    }

    function handleIsStaticChange(isStatic: boolean) {
        setIsStatic(isStatic);
        localStorage.setItem(IS_STATIC_STORAGE_KEY, isStatic.toString());
    }

    useEffect(() => {
        const storedDefinition = localStorage.getItem(
            MAP_DEFINITION_STORAGE_KEY,
        ) as definitions | null;
        const definitionsValues = Object.keys(MAP_DEFINITIONS);
        if (storedDefinition && definitionsValues.includes(storedDefinition)) {
            setMapDefinition(storedDefinition);
        }
    }, [setMapDefinition]);

    useEffect(() => {
        const storedProjection = localStorage.getItem(
            GEO_PROJECTION_STORAGE_KEY,
        ) as string | null;
        const projectionValues = projections.map((p) => p.name);
        if (
            storedProjection &&
            projectionValues.includes(storedProjection as ProjectionName)
        ) {
            setGeoProjection(storedProjection);
        }
    }, [setGeoProjection]);

    useEffect(() => {
        const storedIsStatic = localStorage.getItem(IS_STATIC_STORAGE_KEY) as
            | string
            | null;
        if (storedIsStatic !== null) {
            setIsStatic(storedIsStatic === "true");
        }
    }, [setIsStatic]);

    return (
        <Fragment>
            <div
                className="overlay"
                onClick={() => setOpen(false)}
                style={{ display: open ? "block" : "none" }}
            />
            <div
                className="param-bar"
                style={{
                    transform: open
                        ? "translateX(-50%)"
                        : "translateX(-50%) translateY(-200%)",
                }}
            >
                <div className="rows">
                    <p>{t("select-theme")}</p>
                    <ThemeSwitch />
                </div>
                <div className="rows">
                    <p>{t("select-language")}</p>
                    <FlagSelectMenu
                        options={["fr", "en"]}
                        selectedOption={locale}
                    />
                </div>
                <p>{t("map-definition")}</p>
                <div className="rows">
                    {Object.keys(MAP_DEFINITIONS).map((def) => (
                        <button
                            key={def}
                            className={`btn ${mapDefinition === def ? "active" : ""}`}
                            type="button"
                            onClick={() => handleDefinitionChange(def)}
                        >
                            {t(def)}
                        </button>
                    ))}
                </div>
                <p>{t("map-projection")}</p>
                <SelectMenu
                    id="projection-select"
                    options={projections.map((p) => ({
                        label: t(p.name),
                        value: p.name,
                    }))}
                    selectedOption={t(geoProjection)}
                    onOptionSelect={handleProjectionChange}
                />
                <Checkbox
                    id="static-map-checkbox"
                    label={t("static-map")}
                    title={t("static-map-desc")}
                    checked={isStatic}
                    onChange={(e) => handleIsStaticChange(e.target.checked)}
                />
                <button
                    className="btn"
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{ width: "200px", margin: "0.5rem auto" }}
                >
                    {t("close")}
                </button>
            </div>
        </Fragment>
    );
}
