"use client";

import { type JSX, useState } from "react";

import list_products from "@/data/N890_LIB.json";
import metadata from "@/data/metadata.json";

import Checkbox from "./personal.tsx/checkbox";
import MonthSelector from "./personal.tsx/monthSelector";
import SelectMenu from "./personal.tsx/selectMenu";
import { MultiSelect } from "./ui/multi-select";

interface ConfigBarProps {
    typeData: number;
    currentYear: number;
    currentMonth: number;
    productsSelected: number[];
    countriesSelected: number[];
    isMultipleMode: boolean;
    setTypeData: (type: number) => void;
    setCurrentYear: (year: number) => void;
    setCurrentMonth: (month: number) => void;
    setProductsSelected: (products: number[]) => void;
    setCountriesSelected: (countries: number[]) => void;
    setIsMultipleMode: (isMultiple: boolean) => void;
}

export default function ConfigBar({
    typeData,
    currentYear,
    currentMonth,
    productsSelected,
    countriesSelected,
    isMultipleMode,
    setTypeData,
    setCurrentYear,
    setCurrentMonth,
    setProductsSelected,
    setCountriesSelected,
    setIsMultipleMode,
}: ConfigBarProps): JSX.Element {
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

    return (
        <div className={`config-bar ${isOpen ? "" : "closed"}`}>
            <button
                className="btn btn-close-config"
                type="button"
                aria-label="Close configuration bar"
                title="Close configuration bar"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? "×" : "⚙️"}
            </button>

            <h2 className="h2-primary">Configuration</h2>
            <p>Type de données :</p>
            <div
                className="rows"
                style={{ gap: 0 }}
            >
                <button
                    className={`btn ${typeData === 0 || typeData === 2 ? "btn-selected" : ""}`}
                    type="button"
                    onClick={() => handleTypeDataChange(0, isVolume)}
                    style={{
                        width: "120px",
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                >
                    Exportation
                </button>
                <button
                    className={`btn ${typeData === 1 || typeData === 3 ? "btn-selected" : ""}`}
                    type="button"
                    onClick={() => handleTypeDataChange(1, isVolume)}
                    style={{
                        borderRadius: 0,
                        width: "120px",
                        borderLeft: "none",
                    }}
                >
                    Importation
                </button>
                <button
                    className={`btn ${typeData === 4 ? "btn-selected" : ""}`}
                    type="button"
                    onClick={() => handleTypeDataChange(4, isVolume)}
                    style={{
                        width: "120px",
                        borderLeft: "none",
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                >
                    Balance
                </button>
            </div>
            <div
                className="rows"
                style={{ gap: 0 }}
            >
                <button
                    className={`btn ${typeData === 0 || typeData === 1 ? "btn-selected" : ""}`}
                    type="button"
                    disabled={typeData === 4}
                    onClick={() => handleTypeDataChange(typeData, true)}
                    style={{
                        width: "180px",
                        borderTop: "none",
                        borderTopRightRadius: 0,
                        borderTopLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                >
                    Volume (tonnes)
                </button>
                <button
                    className={`btn ${typeData === 2 || typeData === 3 ? "btn-selected" : ""}`}
                    type="button"
                    onClick={() => handleTypeDataChange(typeData, false)}
                    style={{
                        width: "180px",
                        borderLeft: "none",
                        borderTop: "none",
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                    }}
                >
                    Valeur k€
                </button>
            </div>

            <p>Choix de la date :</p>
            <div
                className="rows"
                style={{ gap: 0 }}
            >
                <button
                    className="btn"
                    type="button"
                    aria-label="Decrease year"
                    title="Decrease year"
                    style={{
                        height: "40px",
                        width: "40px",
                        borderRight: "none",
                        borderBottom: "none",
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        borderBottomLeftRadius: 0,
                    }}
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
                    aria-label="Increase year"
                    title="Increase year"
                    onClick={() => handleYearChange(currentYear + 1)}
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
            <p>Groupe de produits :</p>

            <p>Produits individuels :</p>
            <MultiSelect
                options={Object.entries(list_products).map(([key, value]) => ({
                    label: value,
                    value: key,
                }))}
                onValueChange={handleNewProductsSelected}
                style={{ maxWidth: "360px" }}
            />
            <p>Pays sélectionnés :</p>
            <Checkbox
                id="multiple-mode-checkbox"
                label="Mode de sélection multiple"
                checked={isMultipleMode}
                onChange={(e) => setIsMultipleMode(e.target.checked)}
            />
        </div>
    );
}
