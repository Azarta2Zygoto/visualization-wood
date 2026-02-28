"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { type JSX, useState } from "react";

import NumberFlow from "@number-flow/react";
import { hasFlag } from "country-flag-icons";

import MODOpener from "@/components/MOD_opener";
import { useGlobal } from "@/components/globalProvider";
import Checkbox from "@/components/personal/checkbox";
import MonthSelector from "@/components/personal/monthSelector";
import NumberSelectMenu from "@/components/personal/numberSelectMenu";
import { MultiSelect } from "@/components/ui/multi-select";
import pays from "@/data/countries.json";
import metadata from "@/data/metadata.json";
import icon_symbol from "@/data/symboles.json";
import {
    NBMaxElement,
    calculateNBSingleElementSelected,
} from "@/utils/MODLecture";

interface ConfigBarProps {
    typeData: number;
    currentYear: number;
    currentMonth: number;
    isMultipleMode: boolean;
    isGlobalView: boolean;
    isCountryMode: boolean;
    isAbsolute: boolean;
    productsSelected: number[];
    countriesSelected: number[];
    NBCountryWithData: number;
    isAllDataLoaded?: boolean;
    setTypeData: (type: number) => void;
    setCurrentYear: (year: number) => void;
    setCurrentMonth: (month: number) => void;
    setProductsSelected: (products: number[]) => void;
    setCountriesSelected: (countries: number[]) => void;
    setIsMultipleMode: (isMultiple: boolean) => void;
    setIsGlobalView: (isGlobalView: boolean) => void;
    setIsCountryMode: (isCountryMode: boolean) => void;
    setIconSelected: (icons: string[]) => void;
    setIsAbsolute: (isAbsolute: boolean) => void;
    setGetAllData: () => void;
}

export default function ConfigBar({
    typeData,
    currentYear,
    currentMonth,
    isMultipleMode,
    isGlobalView,
    isCountryMode,
    isAbsolute,
    productsSelected,
    countriesSelected,
    NBCountryWithData,
    isAllDataLoaded,
    setTypeData,
    setCurrentYear,
    setCurrentMonth,
    setProductsSelected,
    setCountriesSelected,
    setIsMultipleMode,
    setIsGlobalView,
    setIsCountryMode,
    setIconSelected,
    setIsAbsolute,
    setGetAllData,
}: ConfigBarProps): JSX.Element {
    const t = useTranslations("ConfigBar");
    const { locale } = useGlobal();

    const [isOpen, setIsOpen] = useState<boolean>(true);
    const [isOpenProducts, setIsOpenProducts] = useState<boolean>(false);

    function handleYearChange(newYear: number) {
        if (
            newYear >= metadata.bois.start_year &&
            newYear <= metadata.bois.end_year
        ) {
            setCurrentYear(newYear);
        }
    }

    function handleTypeDataChange(
        exportMode: boolean | null,
        volumeMode: boolean | null,
    ) {
        if (exportMode === null && volumeMode === null) {
            setTypeData(4); // balance
            return;
        }

        if (exportMode !== null) {
            if (exportMode) {
                setTypeData(typeData < 2 ? 0 : 2); // toggle between export volume and value
            } else {
                setTypeData(typeData < 2 ? 1 : 3); // toggle between import volume and value
            }
        }
        if (volumeMode !== null) {
            if (volumeMode) {
                setTypeData(typeData % 2); // switch to volume
            } else {
                setTypeData((typeData % 2) + 2); // switch to value
            }
        }
    }

    function handleCountryModeChange(isCountryMode: boolean) {
        setIsCountryMode(isCountryMode);
        setCountriesSelected([]); // reset selected countries when changing mode
    }

    function handleNewIconSelected(newIcons: string[]) {
        setIconSelected(newIcons);
    }

    function handleCloseProducts() {
        setIsOpenProducts(false);
        if (productsSelected.length === 0) {
            setProductsSelected([0]); // select all if none selected
        }
    }

    return (
        <div
            className={`config-bar ${isOpen ? "" : "closed"}`}
            role="region"
            aria-hidden={!isOpen}
        >
            <button
                className="btn btn-close-config"
                type="button"
                aria-label={isOpen ? t("close-config") : t("open-config")}
                title={isOpen ? t("close-config") : t("open-config")}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? "×" : "⚙️"}
            </button>

            <div className="config-bar-content">
                <p>{t("visu")}</p>
                <Checkbox
                    id="global-view-checkbox"
                    label={t("global-view")}
                    checked={isGlobalView}
                    onChange={(e) => setIsGlobalView(e.target.checked)}
                />
                <p>{t("study-scale")}</p>
                <div
                    className="rows"
                    style={{ gap: 0 }}
                >
                    <button
                        className={`btn ${isCountryMode ? "active" : ""}`}
                        type="button"
                        aria-pressed={isCountryMode}
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
                        aria-pressed={!isCountryMode}
                        onClick={() => handleCountryModeChange(false)}
                        style={{
                            width: "clamp(90px, 15vw, 180px)",
                            borderLeftColor: "transparent",
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                        }}
                    >
                        {t("continent")}
                    </button>
                </div>
                <p>{t("data-type")}</p>
                <div>
                    <div
                        className="rows"
                        style={{ gap: 0 }}
                    >
                        <button
                            className={`btn ${typeData === 0 || typeData === 2 ? "active" : ""}`}
                            type="button"
                            onClick={() => handleTypeDataChange(true, null)}
                            aria-label={t("export-desc")}
                            aria-pressed={typeData === 0 || typeData === 2}
                            title={t("export-desc")}
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
                            aria-pressed={typeData === 1 || typeData === 3}
                            onClick={() => handleTypeDataChange(false, null)}
                            aria-label={t("import-desc")}
                            title={t("import-desc")}
                            style={{
                                borderRadius: 0,
                                width: "clamp(60px, 10vw, 120px)",
                                borderLeft: "transparent",
                            }}
                        >
                            {t("import")}
                        </button>
                        <button
                            className={`btn ${typeData === 4 ? "active" : ""}`}
                            type="button"
                            aria-pressed={typeData === 4}
                            onClick={() => handleTypeDataChange(null, null)}
                            aria-label={t("balance-desc")}
                            title={t("balance-desc")}
                            style={{
                                width: "clamp(60px, 10vw, 120px)",
                                borderLeftColor: "transparent",
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
                                aria-pressed={typeData === 0 || typeData === 2}
                                aria-hidden={typeData === 4}
                                onClick={() => handleTypeDataChange(null, true)}
                                aria-label={t("volume-desc")}
                                title={t("volume-desc")}
                                style={{
                                    width: "clamp(90px, 15vw, 180px)",
                                    borderTopColor: "transparent",
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
                                onClick={() =>
                                    handleTypeDataChange(null, false)
                                }
                                aria-pressed={typeData === 2 || typeData === 3}
                                aria-label={t("value-desc")}
                                aria-hidden={typeData === 4}
                                title={t("value-desc")}
                                style={{
                                    width: "clamp(90px, 15vw, 180px)",
                                    borderLeftColor: "transparent",
                                    borderTopColor: "transparent",
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
                                aria-pressed={isAbsolute}
                                aria-label={t("value-absolute-desc")}
                                aria-hidden={typeData !== 4}
                                title={t("value-absolute-desc")}
                                onClick={() => setIsAbsolute(true)}
                                style={{
                                    width: "clamp(90px, 15vw, 180px)",
                                    borderTopColor: "transparent",
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
                                aria-pressed={!isAbsolute}
                                aria-label={t("value-relative-desc")}
                                aria-hidden={typeData !== 4}
                                title={t("value-relative-desc")}
                                onClick={() => setIsAbsolute(false)}
                                style={{
                                    width: "clamp(90px, 15vw, 180px)",
                                    borderLeftColor: "transparent",
                                    borderTopColor: "transparent",
                                    borderTopLeftRadius: 0,
                                    borderTopRightRadius: 0,
                                    borderBottomLeftRadius: 0,
                                }}
                            >
                                {t("value-relative")}
                            </button>
                        </div>
                    )}
                </div>

                <div
                    className="rows"
                    style={{ justifyContent: "space-between" }}
                >
                    <p>{t("date-choose")}</p>
                    {!isAllDataLoaded && (
                        <button
                            className="btn"
                            type="button"
                            onClick={setGetAllData}
                            aria-label={t("load-all-data-desc")}
                            title={t("load-all-data-desc")}
                            disabled={isAllDataLoaded}
                            style={{ maxWidth: "clamp(90px, 15vw, 180px)" }}
                        >
                            {t("load-all-data")}
                        </button>
                    )}
                </div>
                <div>
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
                                borderRightColor: "transparent",
                                borderBottomColor: "transparent",
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderBottomLeftRadius: 0,
                            }}
                            disabled={currentYear <= metadata.bois.start_year}
                            onClick={() => handleYearChange(currentYear - 1)}
                        >
                            {"<"}
                        </button>

                        <NumberSelectMenu
                            id="year-select"
                            style={{
                                borderRadius: 0,
                                width: "100px",
                                borderBottomColor: "transparent",
                            }}
                            options={Array.from(
                                {
                                    length:
                                        metadata.bois.end_year -
                                        metadata.bois.start_year +
                                        1,
                                },
                                (_, i) => metadata.bois.start_year + i,
                            )}
                            selectedOption={currentYear}
                            onOptionSelect={handleYearChange}
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
                                borderLeftColor: "transparent",
                                borderBottomColor: "transparent",
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
                </div>

                <div
                    className="rows"
                    style={{ justifyContent: "space-between" }}
                >
                    <p>{t("product-choose")}</p>

                    <p title={t("nb-product")}>
                        <NumberFlow
                            value={calculateNBSingleElementSelected(
                                productsSelected,
                            )}
                        />{" "}
                        / {NBMaxElement}
                    </p>
                </div>
                <button
                    className="btn"
                    type="button"
                    onClick={() => setIsOpenProducts(true)}
                    style={{ maxWidth: "clamp(120px, 20vw, 240px)" }}
                >
                    {t("select-products")}
                </button>
                <div
                    className="rows"
                    style={{ justifyContent: "space-between" }}
                >
                    <p>
                        {isCountryMode
                            ? t("country-choose")
                            : t("continent-choose")}
                    </p>
                    <p title={t("nb-country")}>
                        <NumberFlow value={countriesSelected.length} /> /
                        {" " + NBCountryWithData}
                    </p>
                </div>
                <div
                    className="infinite-element"
                    style={{
                        flexWrap: isCountryMode ? "wrap" : "nowrap",
                        flexDirection: isCountryMode ? "row" : "column",
                    }}
                >
                    {countriesSelected.map((countryNumberCode) => {
                        const country =
                            pays[
                                String(countryNumberCode) as keyof typeof pays
                            ];
                        if (!country) return null;
                        if (hasFlag(country.code))
                            return (
                                <span
                                    key={countryNumberCode}
                                    className="rows"
                                >
                                    {!isCountryMode && (
                                        <p>
                                            {locale === "en"
                                                ? country.en
                                                : country.fr || "unknown"}
                                        </p>
                                    )}
                                    <Image
                                        className="tooltip-country"
                                        alt={t("flag", {
                                            country:
                                                locale === "en"
                                                    ? country.en
                                                    : country.fr || "unknown",
                                        })}
                                        title={t("flag", {
                                            country:
                                                locale === "en"
                                                    ? country.en
                                                    : country.fr || "unknown",
                                        })}
                                        aria-label={t("flag", {
                                            country:
                                                locale === "en"
                                                    ? country.en
                                                    : country.fr || "unknown",
                                        })}
                                        width={24}
                                        height={18}
                                        src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${country.code}.svg`}
                                    />
                                </span>
                            );
                        else
                            return (
                                <p key={countryNumberCode}>
                                    {locale === "en" ? country.en : country.fr}
                                </p>
                            );
                    })}
                </div>
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
                <MODOpener
                    isOpen={isOpenProducts}
                    onOpen={handleCloseProducts}
                    setProductsSelected={setProductsSelected}
                    productsSelected={productsSelected}
                />
            </div>
        </div>
    );
}
