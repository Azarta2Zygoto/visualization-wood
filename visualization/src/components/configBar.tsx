"use client";

import { useTranslations } from "next-intl";
import { type JSX, useState } from "react";

import list_products from "@/data/N890_LIB.json";
import metadata from "@/data/metadata.json";
import icon_symbol from "@/data/symboles.json";

import Checkbox from "./personal/checkbox";
import MonthSelector from "./personal/monthSelector";
import SelectMenu from "./personal/selectMenu";
import { MultiSelect } from "./ui/multi-select";

interface ConfigBarProps {
    typeData: number;
    currentYear: number;
    currentMonth: number;
    isMultipleMode: boolean;
    isCountryMode: boolean;
    isAbsolute: boolean;
    setTypeData: (type: number) => void;
    setCurrentYear: (year: number) => void;
    setCurrentMonth: (month: number) => void;
    setProductsSelected: (products: number[]) => void;
    setCountriesSelected: (countries: number[]) => void;
    setIsMultipleMode: (isMultiple: boolean) => void;
    setIsCountryMode: (isCountryMode: boolean) => void;
    setIconSelected: (icons: string[]) => void;
    setIsAbsolute: (isAbsolute: boolean) => void;
}

export default function ConfigBar({
    typeData,
    currentYear,
    currentMonth,
    isMultipleMode,
    isCountryMode,
    isAbsolute,
    setTypeData,
    setCurrentYear,
    setCurrentMonth,
    setProductsSelected,
    setCountriesSelected,
    setIsMultipleMode,
    setIsCountryMode,
    setIconSelected,
    setIsAbsolute,
}: ConfigBarProps): JSX.Element {
    const t = useTranslations("ConfigBar");

    const [isVolume, setIsVolume] = useState<boolean>(true);
    const [isOpen, setIsOpen] = useState<boolean>(true);

    function handleYearChange(newYear: number) {
        if (
            newYear >= metadata.bois.start_year &&
            newYear <= metadata.bois.end_year
        ) {
            setCurrentYear(newYear);
        }
    }

    function handleTypeDataChange(newType: number, newIsVolume: boolean) {
        if (newType === 4) {
            setTypeData(4);
            setIsVolume(false);
            return;
        }

        newType = newType % 2; // ensure newType is 0 or 1
        setIsVolume(newIsVolume);
        if (newIsVolume) {
            setTypeData(newType);
        } else {
            // currently in value mode
            setTypeData(newType + 2);
        }
    }

    function handleNewProductsSelected(newProducts: string[]) {
        const numericProducts = newProducts.map((prod) => parseInt(prod, 10));
        setProductsSelected(numericProducts);
    }

    function handleCountryModeChange(isCountryMode: boolean) {
        setIsCountryMode(isCountryMode);
        setCountriesSelected([]); // reset selected countries when changing mode
    }

    function handleNewIconSelected(newIcons: string[]) {
        setIconSelected(newIcons);
    }

    return (
        <div className={`config-bar ${isOpen ? "" : "closed"}`}>
            <button
                className="btn btn-close-config"
                type="button"
                aria-label={isOpen ? t("close-config") : t("open-config")}
                title={isOpen ? t("close-config") : t("open-config")}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? "×" : "⚙️"}
            </button>

            <h2 className="h2-primary">{t("config")}</h2>
            <p>{t("study-scale")}</p>
            <div
                className="rows"
                style={{ gap: 0 }}
            >
                <button
                    className={`btn ${isCountryMode ? "active" : ""}`}
                    type="button"
                    onClick={() => handleCountryModeChange(true)}
                    style={{
                        width: "clamp(90px, 15vw, 180px)",
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                >
                    {t("country")}
                </button>
                <button
                    className={`btn ${!isCountryMode ? "active" : ""}`}
                    type="button"
                    onClick={() => handleCountryModeChange(false)}
                    style={{
                        width: "clamp(90px, 15vw, 180px)",
                        borderLeft: "none",
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                    }}
                >
                    {t("continent")}
                </button>
            </div>
            <p>{t("data-type")}</p>
            <div
                className="rows"
                style={{ gap: 0 }}
            >
                <button
                    className={`btn ${typeData === 0 || typeData === 2 ? "active" : ""}`}
                    type="button"
                    onClick={() => handleTypeDataChange(0, isVolume)}
                    style={{
                        width: "clamp(60px, 10vw, 120px)",
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                >
                    {t("export")}
                </button>
                <button
                    className={`btn ${typeData === 1 || typeData === 3 ? "active" : ""}`}
                    type="button"
                    onClick={() => handleTypeDataChange(1, isVolume)}
                    style={{
                        borderRadius: 0,
                        width: "clamp(60px, 10vw, 120px)",
                        borderLeft: "none",
                    }}
                >
                    {t("import")}
                </button>
                <button
                    className={`btn ${typeData === 4 ? "active" : ""}`}
                    type="button"
                    onClick={() => handleTypeDataChange(4, isVolume)}
                    style={{
                        width: "clamp(60px, 10vw, 120px)",
                        borderLeft: "none",
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                >
                    {t("balance")}
                </button>
            </div>
            {typeData !== 4 ? (
                <div
                    className="rows"
                    style={{ gap: 0 }}
                >
                    <button
                        className={`btn ${typeData === 0 || typeData === 1 ? "active" : ""}`}
                        type="button"
                        disabled={typeData === 4}
                        onClick={() => handleTypeDataChange(typeData, true)}
                        style={{
                            width: "clamp(90px, 15vw, 180px)",
                            borderTop: "none",
                            borderTopRightRadius: 0,
                            borderTopLeftRadius: 0,
                            borderBottomRightRadius: 0,
                        }}
                    >
                        {t("volume")}
                    </button>
                    <button
                        className={`btn ${typeData === 2 || typeData === 3 ? "active" : ""}`}
                        type="button"
                        onClick={() => handleTypeDataChange(typeData, false)}
                        style={{
                            width: "clamp(90px, 15vw, 180px)",
                            borderLeft: "none",
                            borderTop: "none",
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            borderBottomLeftRadius: 0,
                        }}
                    >
                        {t("value")}
                    </button>
                </div>
            ) : (
                <div
                    className="rows"
                    style={{ gap: 0 }}
                >
                    <button
                        className={`btn ${isAbsolute ? "active" : ""}`}
                        type="button"
                        onClick={() => setIsAbsolute(true)}
                        style={{
                            width: "clamp(90px, 15vw, 180px)",
                            borderTop: "none",
                            borderTopRightRadius: 0,
                            borderTopLeftRadius: 0,
                            borderBottomRightRadius: 0,
                        }}
                    >
                        {t("value-absolute")}
                    </button>
                    <button
                        className={`btn ${!isAbsolute ? "active" : ""}`}
                        type="button"
                        onClick={() => setIsAbsolute(false)}
                        style={{
                            width: "clamp(90px, 15vw, 180px)",
                            borderLeft: "none",
                            borderTop: "none",
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            borderBottomLeftRadius: 0,
                        }}
                    >
                        {t("value-relative")}
                    </button>
                </div>
            )}

            <p>{t("date-choose")}</p>
            <div
                className="rows"
                style={{ gap: 0 }}
            >
                <button
                    className="btn"
                    type="button"
                    aria-label={t("decrease-year")}
                    title={t("decrease-year")}
                    style={{
                        height: "40px",
                        width: "40px",
                        borderRight: "none",
                        borderBottom: "none",
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        borderBottomLeftRadius: 0,
                    }}
                    disabled={currentYear <= metadata.bois.start_year}
                    onClick={() => handleYearChange(currentYear - 1)}
                >
                    {"<"}
                </button>

                <SelectMenu
                    id="year-select"
                    style={{
                        borderRadius: 0,
                        width: "100px",
                        borderBottom: "none",
                    }}
                    options={Array.from(
                        {
                            length:
                                metadata.bois.end_year -
                                metadata.bois.start_year +
                                1,
                        },
                        (_, i) => (metadata.bois.start_year + i).toString(),
                    )}
                    selectedOption={currentYear.toString()}
                    onOptionSelect={(option: string) =>
                        handleYearChange(parseInt(option, 10))
                    }
                />
                <button
                    className="btn"
                    type="button"
                    aria-label={t("increase-year")}
                    title={t("increase-year")}
                    onClick={() => handleYearChange(currentYear + 1)}
                    disabled={currentYear >= metadata.bois.end_year}
                    style={{
                        height: "40px",
                        width: "40px",
                        borderLeft: "none",
                        borderBottom: "none",
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                >
                    {">"}
                </button>
            </div>
            <MonthSelector
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
            />

            <p>{t("product-choose")}</p>
            <MultiSelect
                id="lang"
                options={Object.entries(list_products).map(([key, value]) => ({
                    label: value,
                    value: key,
                }))}
                onValueChange={handleNewProductsSelected}
                style={{ maxWidth: "clamp(180px, 30vw, 360px)" }}
            />
            <p>{isCountryMode ? t("country-choose") : t("continent-choose")}</p>
            <Checkbox
                id="multiple-mode-checkbox"
                label={t("multiple-selection")}
                checked={isMultipleMode}
                onChange={(e) => setIsMultipleMode(e.target.checked)}
            />

            <p>{t("historic")}</p>
            <MultiSelect
                id="icon"
                options={Object.keys(icon_symbol).map((key) => ({
                    label: key,
                    value: key,
                }))}
                onValueChange={handleNewIconSelected}
                style={{ maxWidth: "clamp(180px, 30vw, 360px)" }}
            />
        </div>
    );
}
