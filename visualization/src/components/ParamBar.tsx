"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX } from "react";

import { projections } from "@/data/geoprojection";

import { useGlobal } from "./globalProvider";
import FlagSelectMenu from "./personal/flagSelectMenu";
import SelectMenu from "./personal/selectMenu";
import ThemeSwitch from "./personal/themeSwitch";

const definitions = ["low", "medium", "high"] as const;

interface ParamBarProps {
    open: boolean;
    mapDefinition: string;
    geoProjection: string;
    setOpen: (open: boolean) => void;
    setMapDefinition: (definition: string) => void;
    setGeoProjection: (projection: string) => void;
}

export default function ParamBar({
    open,
    mapDefinition,
    geoProjection,
    setOpen,
    setMapDefinition,
    setGeoProjection,
}: ParamBarProps): JSX.Element {
    const t = useTranslations("ParamBar");

    const { locale } = useGlobal();

    function handleDefinitionChange(definition: string) {
        setMapDefinition(definition);
    }

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
                    {definitions.map((def) => (
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
                    onOptionSelect={setGeoProjection}
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
