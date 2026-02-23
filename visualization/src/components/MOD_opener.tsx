"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useState } from "react";

import AttentionInner from "@/components/attentionInner";
import Accordeon from "@/components/personal/accordeon";
import Checkbox from "@/components/personal/checkbox";
import products from "@/data/products.json";
import { processMODData } from "@/utils/MODLecture";

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

    const [firstAttentionShown, setFirstAttentionShown] =
        useState<boolean>(false);
    const [openDefault, setOpenDefault] = useState<boolean>(false);

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
                <div className="rows">
                    <button
                        className={`btn ${productsSelected.includes(0) ? "active" : ""}`}
                        onClick={() => setProductsSelected([0])}
                        type="button"
                        style={{ marginBottom: "20px" }}
                    >
                        {t("select-all")}
                    </button>
                    <button
                        className={`btn ${productsSelected.length === 0 ? "active" : ""}`}
                        onClick={() => setProductsSelected([])}
                        type="button"
                        style={{ marginBottom: "20px" }}
                    >
                        {t("deselect-all")}
                    </button>
                    <div className="rows">
                        <button
                            className="btn"
                            onClick={() => setOpenDefault(true)}
                            type="button"
                            style={{ marginBottom: "20px" }}
                        >
                            {t("open-all")}
                        </button>
                        <button
                            className="btn"
                            onClick={() => setOpenDefault(false)}
                            type="button"
                            style={{ marginBottom: "20px" }}
                        >
                            {t("close-all")}
                        </button>
                    </div>
                </div>
                <div className="inner-mod">
                    <MODRecursif
                        data={MOD[0] as typeof MOD}
                        setProductsSelected={setProductsSelected}
                        selectedProducts={productsSelected}
                        isChecked={productsSelected.includes(0)}
                        depth={0}
                        openDefault={openDefault}
                    />
                </div>
                {productsSelected.length === 0 && !firstAttentionShown && (
                    <AttentionInner
                        text={t("attention-text")}
                        isOpen={productsSelected.length === 0}
                        hasBeenClosed={() => setFirstAttentionShown(true)}
                    />
                )}
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
    openDefault?: boolean;
}

function MODRecursif({
    data,
    setProductsSelected,
    selectedProducts,
    isChecked = false,
    depth = 0,
    openDefault = false,
}: MODRecursifProps): JSX.Element {
    const name = data.name;
    const code = data.code;
    const children = Object.keys(data).filter(
        (key) => key !== "name" && key !== "code",
    );

    function handleCheckboxChange() {
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
                //c est le code d'un parent de code, il faut ajouter tous les enfants de c récursivement
                const expandedCodes = expandChildrenUntilTarget(
                    c,
                    code,
                    correctNumberCode,
                );
                expandedCodes.forEach((childCode) => {
                    if (!newProductsSelected.includes(childCode)) {
                        newProductsSelected.push(childCode);
                    }
                });
                isRelated = true;
                return;
            } else if (c.startsWith(code)) {
                // c est le code d'un enfant de code, il faut ajouter tous les parents de c
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
            if (!newProductsSelected.includes(correctNumberCode)) {
                newProductsSelected.push(correctNumberCode);
            }
        }
        let parentSiblings = parentsIfAllChildrenSelected([
            ...newProductsSelected,
        ]);
        Object.keys(parentSiblings).forEach((parent) => {
            const p = Number(parent);
            if (!newProductsSelected.includes(p)) {
                newProductsSelected.push(p);
            }
            parentSiblings[p].forEach((sibling) => {
                const idx = newProductsSelected.indexOf(sibling);
                if (idx !== -1) newProductsSelected.splice(idx, 1);
            });
        });
        while (Object.keys(parentSiblings).length > 0) {
            parentSiblings = parentsIfAllChildrenSelected([
                ...newProductsSelected,
            ]);
            Object.keys(parentSiblings).forEach((newParent) => {
                const p = Number(newParent);
                if (!newProductsSelected.includes(p)) {
                    newProductsSelected.push(p);
                }
                parentSiblings[p].forEach((sibling) => {
                    const idx = newProductsSelected.indexOf(sibling);
                    if (idx !== -1) newProductsSelected.splice(idx, 1);
                });
            });
        }
        setProductsSelected(newProductsSelected);
    }

    if (!children.length) {
        return (
            <Checkbox
                id={`checkbox-${code}`}
                label={name}
                className="checkbox-product"
                checked={isChecked || IsParentSelected(code, selectedProducts)}
                onChange={handleCheckboxChange}
            />
        );
    } else {
        return (
            <Accordeon
                name={`${code}-${name}`}
                isOpen={openDefault}
                items={{
                    title: (
                        <Checkbox
                            id={`checkbox-${code}`}
                            label={name}
                            title={`Select all in ${name}`}
                            className="checkbox-product"
                            checked={
                                isChecked ||
                                IsParentSelected(code, selectedProducts)
                            }
                            onChange={handleCheckboxChange}
                        />
                    ),
                    content: (
                        <div className="ml-4">
                            {children
                                .sort(
                                    (a, b) =>
                                        Object.keys(data[b]).length -
                                        Object.keys(data[a]).length,
                                )
                                .map((childKey) => (
                                    <MODRecursif
                                        key={childKey}
                                        data={data[childKey] as typeof MOD}
                                        setProductsSelected={
                                            setProductsSelected
                                        }
                                        selectedProducts={selectedProducts}
                                        isChecked={
                                            isChecked ||
                                            IsParentSelected(
                                                code,
                                                selectedProducts,
                                            )
                                        }
                                        depth={depth + 1}
                                        openDefault={openDefault}
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

/**
 * Recursively expand children from parentCode until the targetCode is found.
 * At each level, add siblings of the branch leading to targetCode.
 * @param parentCode - The parent code to start expanding from
 * @param targetCode - The code we're looking for (to exclude)
 * @param targetNumberCode - The number key of the target (to exclude)
 * @returns Array of number codes to add to selection
 */
function expandChildrenUntilTarget(
    parentCode: string,
    targetCode: string,
    targetNumberCode: number,
): number[] {
    const result: number[] = [];
    const directChildren = getAllDirectChildren(parentCode);

    for (const childNumberCode of directChildren) {
        const childCode =
            products[String(childNumberCode) as keyof typeof products].code;

        if (childNumberCode === targetNumberCode) {
            // This is the target - skip it
            continue;
        }

        if (targetCode.startsWith(childCode)) {
            // This child is an ancestor of the target - recurse into it
            const nestedResults = expandChildrenUntilTarget(
                childCode,
                targetCode,
                targetNumberCode,
            );
            result.push(...nestedResults);
        } else {
            // This child is a sibling of the branch - add it
            result.push(childNumberCode);
        }
    }

    return result;
}

function parentsIfAllChildrenSelected(selectedProducts: number[]): {
    [key: number]: number[];
} {
    const newSelectedProducts: { [key: number]: number[] } = {};

    selectedProducts.forEach((product) => {
        const productCode =
            products[String(product) as keyof typeof products].code;

        const parentCode = productCode.split(".").slice(0, -1).join(".");

        if (parentCode === "0" || parentCode) {
            const siblings = getAllDirectChildren(parentCode);

            if (
                siblings.every((sibling) => selectedProducts.includes(sibling))
            ) {
                const parentNumberCode = Object.keys(products).find(
                    (key) =>
                        products[key as keyof typeof products].code ===
                        parentCode,
                );
                if (
                    parentNumberCode &&
                    !Object.keys(newSelectedProducts).includes(
                        String(parentNumberCode),
                    )
                ) {
                    newSelectedProducts[Number(parentNumberCode)] = siblings;
                }
            }
        }
    });
    return newSelectedProducts;
}
