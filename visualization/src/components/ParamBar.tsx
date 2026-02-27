"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect } from "react";

import { useGlobal } from "@/components/globalProvider";
import Checkbox from "@/components/personal/checkbox";
import FlagSelectMenu from "@/components/personal/flagSelectMenu";
import SelectMenu from "@/components/personal/selectMenu";
import ThemeSwitch from "@/components/personal/themeSwitch";
import colors from "@/data/colors.json";
import {
    GEO_PROJECTION_STORAGE_KEY,
    IS_DALTONIAN_STORAGE_KEY,
    IS_STATIC_STORAGE_KEY,
    MAP_DEFINITIONS,
    MAP_DEFINITION_STORAGE_KEY,
    PALETTE_COLOR_STORAGE_KEY,
    definitions,
} from "@/metadata/constants";
import { projections } from "@/metadata/geoprojections";
import type { ColorName, ProjectionName } from "@/metadata/types";

interface ParamBarProps {
    isOpen: boolean;
    mapDefinition: definitions;
    geoProjection: ProjectionName;
    isStatic: boolean;
    isDaltonian: boolean;
    paletteColor: ColorName;
    onClose: () => void;
    setMapDefinition: (definition: definitions) => void;
    setGeoProjection: (projection: ProjectionName) => void;
    setIsStatic: (isStatic: boolean) => void;
    setIsDaltonian: (isDaltonian: boolean) => void;
    setPaletteColor: (color: ColorName) => void;
}

export default function ParamBar({
    isOpen,
    mapDefinition,
    geoProjection,
    isStatic,
    isDaltonian,
    paletteColor,
    onClose,
    setMapDefinition,
    setGeoProjection,
    setIsStatic,
    setIsDaltonian,
    setPaletteColor,
}: ParamBarProps): JSX.Element {
    const t = useTranslations("ParamBar");

    const { locale } = useGlobal();

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if ((e.key === "Escape" || e.key === "Backspace") && isOpen)
                onClose();
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        const storedDefinition = localStorage.getItem(
            MAP_DEFINITION_STORAGE_KEY,
        );
        const storedProjection = localStorage.getItem(
            GEO_PROJECTION_STORAGE_KEY,
        );
        const storedIsStatic = localStorage.getItem(IS_STATIC_STORAGE_KEY);
        const storedIsDaltonian = localStorage.getItem(
            IS_DALTONIAN_STORAGE_KEY,
        );
        const storedPaletteColor = localStorage.getItem(
            PALETTE_COLOR_STORAGE_KEY,
        );

        if (
            storedDefinition &&
            Object.keys(MAP_DEFINITIONS).includes(storedDefinition)
        ) {
            setMapDefinition(storedDefinition as definitions);
        }
        if (
            storedProjection &&
            projections.some((p) => p.name === storedProjection)
        ) {
            setGeoProjection(storedProjection as ProjectionName);
        }
        if (storedIsStatic !== null) {
            setIsStatic(storedIsStatic === "true");
        }
        if (storedIsDaltonian !== null) {
            setIsDaltonian(storedIsDaltonian === "true");
        }
        if (
            storedPaletteColor &&
            Object.keys(colors).includes(storedPaletteColor)
        ) {
            setPaletteColor(storedPaletteColor as ColorName);
        }
    }, [
        setMapDefinition,
        setGeoProjection,
        setIsStatic,
        setIsDaltonian,
        setPaletteColor,
    ]);

    function handleDefinitionChange(definition: string) {
        setMapDefinition(definition as definitions);
        localStorage.setItem(MAP_DEFINITION_STORAGE_KEY, definition);
    }

    function handleProjectionChange(projection: ProjectionName) {
        setGeoProjection(projection);
        localStorage.setItem(GEO_PROJECTION_STORAGE_KEY, projection);
    }

    function handleIsStaticChange(isStatic: boolean) {
        setIsStatic(isStatic);
        localStorage.setItem(IS_STATIC_STORAGE_KEY, isStatic.toString());
    }

    function handleIsDaltonianChange(isDaltonian: boolean) {
        setIsDaltonian(isDaltonian);
        localStorage.setItem(IS_DALTONIAN_STORAGE_KEY, isDaltonian.toString());
    }

    function handlePaletteColorChange(color: ColorName) {
        setPaletteColor(color);
        localStorage.setItem(PALETTE_COLOR_STORAGE_KEY, color);
    }

    return (
        <Fragment>
            <div
                className="overlay"
                onClick={onClose}
                style={{ display: isOpen ? "block" : "none" }}
                aria-hidden
                role="presentation"
            />
            <div
                className="param-bar"
                role="dialog"
                aria-modal="true"
                aria-hidden={!isOpen}
                aria-label={t("settings")}
                style={{
                    transform: isOpen
                        ? "translate(-50%, -50%)"
                        : "translate(-50%, -200%)",
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
                    onOptionSelect={(option) =>
                        handleProjectionChange(option as ProjectionName)
                    }
                />
                <Checkbox
                    id="static-map-checkbox"
                    label={t("static-map")}
                    title={t("static-map-desc")}
                    checked={isStatic}
                    onChange={(e) => handleIsStaticChange(e.target.checked)}
                />

                <h2>{t("colorymetry-options")}</h2>
                <SelectMenu
                    id="color-select"
                    options={Object.keys(colors).map((p) => ({
                        label: t(p),
                        value: p,
                    }))}
                    selectedOption={t(paletteColor)}
                    onOptionSelect={(value) =>
                        handlePaletteColorChange(value as ColorName)
                    }
                />
                <Checkbox
                    id="daltonian-mode-checkbox"
                    label={t("daltonian")}
                    title={t("daltonian-desc")}
                    checked={isDaltonian}
                    onChange={(e) => handleIsDaltonianChange(e.target.checked)}
                />
                <button
                    className="btn"
                    type="button"
                    onClick={onClose}
                    style={{ width: "200px", margin: "0.5rem auto" }}
                >
                    {t("close")}
                </button>
            </div>
        </Fragment>
    );
}
