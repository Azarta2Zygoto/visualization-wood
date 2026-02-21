"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX } from "react";

import products from "@/data/products.json";
import { processMODData } from "@/utils/MODLecture";

import Accordeon from "./personal/accordeon";
import Checkbox from "./personal/checkbox";

interface MODOpenerProps {
    isOpen: boolean;
    onOpen: (bool: boolean) => void;
    productsSelected: number[];
    setProductsSelected: (products: number[]) => void;
}

const MOD = processMODData(products);

export default function MODOpener({
    isOpen,
    onOpen,
    productsSelected,
    setProductsSelected,
}: MODOpenerProps): JSX.Element {
    const t = useTranslations("MODOpener");

    function handleSelectAllChange(change: boolean) {
        if (change) {
            setProductsSelected([0]);
        } else {
            setProductsSelected([]);
        }
    }

    return (
        <Fragment>
            <div
                className="overlay"
                onClick={() => onOpen(false)}
                style={{ display: isOpen ? "block" : "none" }}
            />
            <div
                className="MOD-container"
                style={{
                    transform: isOpen
                        ? "translate(-50%, -50%)"
                        : "translate(150%, -50%)",
                }}
            >
                <h2 className="h2-primary">{t("title")}</h2>
                <Checkbox
                    id="checkbox-all"
                    label={t("select-all")}
                    checked={productsSelected.includes(0)}
                    onChange={(e) => handleSelectAllChange(e.target.checked)}
                />
                <div className="inner-mod">
                    <MODRecursif
                        data={MOD[0] as typeof MOD}
                        setProductsSelected={setProductsSelected}
                        selectedProducts={productsSelected}
                        isChecked={productsSelected.includes(0)}
                    />
                </div>
                <button
                    className="btn"
                    onClick={() => onOpen(false)}
                    type="button"
                    style={{ marginTop: "auto" }}
                >
                    {t("close")}
                </button>
            </div>
        </Fragment>
    );
}
interface MODRecursifProps {
    data: typeof MOD;
    setProductsSelected: (products: number[]) => void;
    selectedProducts: number[];
    isChecked?: boolean;
    depth?: number;
}

function MODRecursif({
    data,
    setProductsSelected,
    selectedProducts,
    isChecked = false,
    depth = 0,
}: MODRecursifProps): JSX.Element {
    const name = data.name;
    const code = data.code;
    const children = Object.keys(data).filter(
        (key) => key !== "name" && key !== "code",
    );

    function handleCheckboxChange(e: React.ChangeEvent<HTMLInputElement>) {
        isChecked = e.target.checked;

        const numberCode = Object.keys(products).find(
            (key) => products[key as keyof typeof products].code === code,
        );

        if (!numberCode) return;
        const correctNumberCode = Number(numberCode);

        if (selectedProducts.length === 0) {
            setProductsSelected([correctNumberCode]);
            return;
        }

        const productsCode = selectedProducts.map((c) => {
            const key = Object.keys(products).find(
                (key) => Number(key) === c,
            ) as keyof typeof products;
            return products[key].code;
        });
        if (productsCode.includes(code)) {
            const newProductsSelected = selectedProducts.filter((c) => {
                const key = Object.keys(products).find(
                    (key) => Number(key) === c,
                ) as keyof typeof products;
                return products[key].code !== code;
            });
            setProductsSelected(newProductsSelected);
            return;
        }

        const newProductsSelected: number[] = [];
        let isRelated = false;
        productsCode.forEach((c) => {
            if (code.startsWith(c)) {
                const childrenCodes = getAllDirectChildren(c).filter(
                    (childCode) => childCode !== correctNumberCode,
                );

                childrenCodes.forEach((childCode) => {
                    if (!newProductsSelected.includes(childCode)) {
                        newProductsSelected.push(childCode);
                    }
                });
                isRelated = true;
                return;
            } else if (c.startsWith(code)) {
                if (!newProductsSelected.includes(correctNumberCode)) {
                    newProductsSelected.push(correctNumberCode);
                }
                isRelated = true;
                return;
            } else {
                const numberC = Number(
                    Object.keys(products).find(
                        (key) =>
                            products[key as keyof typeof products].code === c,
                    ),
                );
                if (numberC) {
                    newProductsSelected.push(numberC);
                }
            }
        });
        if (!isRelated) {
            newProductsSelected.push(correctNumberCode);
        }
        setProductsSelected(newProductsSelected);
    }

    if (!children.length) {
        return (
            <Checkbox
                id={`checkbox-${code}`}
                label={name}
                checked={isChecked || IsParentSelected(code, selectedProducts)}
                onChange={handleCheckboxChange}
            />
        );
    } else {
        return (
            <Accordeon
                items={{
                    title: (
                        <Checkbox
                            id={`checkbox-${code}`}
                            label={name}
                            title={`Select all in ${name}`}
                            checked={
                                isChecked ||
                                IsParentSelected(code, selectedProducts)
                            }
                            onChange={handleCheckboxChange}
                        />
                    ),
                    content: (
                        <div className="ml-4">
                            {children.map((childKey) => (
                                <MODRecursif
                                    key={childKey}
                                    data={data[childKey] as typeof MOD}
                                    setProductsSelected={setProductsSelected}
                                    selectedProducts={selectedProducts}
                                    isChecked={
                                        isChecked ||
                                        IsParentSelected(code, selectedProducts)
                                    }
                                    depth={depth + 1}
                                />
                            ))}
                        </div>
                    ),
                }}
                color={`var(--color-special-${(depth % 11) + 1})`}
            />
        );
    }
}

function IsParentSelected(code: string, selectedProducts: number[]): boolean {
    const numberCode = Object.keys(products).find(
        (key) => products[key as keyof typeof products].code === code,
    );
    if (!numberCode) return false;
    const correctNumberCode = Number(numberCode);
    return selectedProducts.includes(correctNumberCode);
}

function getAllDirectChildren(code: string): number[] {
    const children: number[] = [];
    const length = code.split(".").length;

    Object.keys(products).forEach((key) => {
        const productCode = products[key as keyof typeof products].code;
        if (productCode.startsWith(code) && productCode !== code) {
            const childNumberCode = Number(key);
            const childLength = productCode.split(".").length;
            if (
                !children.includes(childNumberCode) &&
                childLength === length + 1
            ) {
                children.push(childNumberCode);
            }
        }
    });
    return children;
}
