"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useCallback, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import AttentionInner from "@/components/attentionInner";
import Accordeon from "@/components/personal/accordeon";
import Checkbox from "@/components/personal/checkbox";
import products from "@/data/products.json";
import { processMODData } from "@/utils/MODLecture";

const codeToNumber = new Map<string, number>();
const numberToCode = new Map<number, string>();
// Precomputed map: parentCode -> array of direct children number codes
const directChildrenMap = new Map<string, number[]>();

Object.entries(products).forEach(([key, val]) => {
    const num = Number(key);
    codeToNumber.set(val.code, num);
    numberToCode.set(num, val.code);

    // Build parent->children map
    const parentCode = val.code.split(".").slice(0, -1).join(".");
    if (parentCode || val.code === "0") {
        const parentKey = parentCode || ""; // root level
        if (!directChildrenMap.has(parentKey)) {
            directChildrenMap.set(parentKey, []);
        }
        directChildrenMap.get(parentKey)!.push(num);
    }
});

const MOD = processMODData(products);

interface MODOpenerProps {
    isOpen: boolean;
    productsSelected: number[];
    onOpen: (bool: boolean) => void;
    setProductsSelected: (products: number[]) => void;
}

export default function MODOpener({
    isOpen,
    productsSelected,
    onOpen,
    setProductsSelected,
}: MODOpenerProps): JSX.Element | null {
    const t = useTranslations("MODOpener");

    const [firstAttentionShown, setFirstAttentionShown] =
        useState<boolean>(false);
    const [openDefault, setOpenDefault] = useState<{
        open: boolean;
        version: number;
    }>({ open: false, version: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if ((e.key === "Escape" || e.key === "Backspace") && isOpen)
                onOpen(false);
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onOpen]);

    const content = (
        <Fragment>
            <div
                className="overlay"
                onClick={() => onOpen(false)}
                style={{ display: isOpen ? "block" : "none" }}
                aria-hidden
                role="presentation"
            />
            <div
                className="MOD-container"
                role="dialog"
                aria-modal="true"
                aria-hidden={!isOpen}
                aria-label={t("products")}
                style={{
                    transform: isOpen
                        ? "translate(-50%, -50%)"
                        : "translate(150%, -50%)",
                }}
            >
                <h2 className="h2-primary">{t("title")}</h2>
                <div
                    className="rows"
                    style={{ marginBottom: "20px" }}
                >
                    <button
                        className={`btn ${productsSelected.includes(0) ? "active" : ""}`}
                        onClick={() => setProductsSelected([0])}
                        type="button"
                    >
                        {t("select-all")}
                    </button>
                    <button
                        className={`btn ${productsSelected.length === 0 ? "active" : ""}`}
                        onClick={() => setProductsSelected([])}
                        type="button"
                    >
                        {t("deselect-all")}
                    </button>
                    <div className="rows">
                        <button
                            className="btn"
                            onClick={() =>
                                setOpenDefault((prev) => ({
                                    open: true,
                                    version: prev.version + 1,
                                }))
                            }
                            type="button"
                        >
                            {t("open-all")}
                        </button>
                        <button
                            className="btn"
                            onClick={() =>
                                setOpenDefault((prev) => ({
                                    open: false,
                                    version: prev.version + 1,
                                }))
                            }
                            type="button"
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
                        openDefault={openDefault.open}
                        openVersion={openDefault.version}
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
    // Render into document.body so position:fixed is relative to viewport
    if (!mounted) return null;
    return createPortal(content, document.body);
}
interface MODRecursifProps {
    data: typeof MOD;
    setProductsSelected: (products: number[]) => void;
    selectedProducts: number[];
    isChecked?: boolean;
    depth?: number;
    openDefault?: boolean;
    openVersion?: number;
}

function MODRecursif({
    data,
    setProductsSelected,
    selectedProducts,
    isChecked = false,
    depth = 0,
    openDefault = false,
    openVersion = 0,
}: MODRecursifProps): JSX.Element {
    const productTrads = useTranslations("Produits");

    const name = data.name;
    const code = data.code;
    const children = Object.keys(data).filter(
        (key) => key !== "name" && key !== "code",
    );

    const handleCheckboxChange = useCallback(() => {
        const numberCode = codeToNumber.get(code);

        if (numberCode === undefined) return;

        if (selectedProducts.length === 0) {
            setProductsSelected([numberCode]);
            return;
        }

        const productsCode = selectedProducts
            .map((c) => {
                return numberToCode.get(c);
            })
            .filter((c): c is string => c !== undefined);

        if (productsCode.includes(code)) {
            const newProductsSelected = selectedProducts.filter((c) => {
                return numberToCode.get(c) !== code;
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
                    numberCode,
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
                if (!newProductsSelected.includes(numberCode)) {
                    newProductsSelected.push(numberCode);
                }
                isRelated = true;
                return;
            } else {
                const numberC = codeToNumber.get(c);
                if (
                    numberC !== undefined &&
                    !newProductsSelected.includes(numberC)
                ) {
                    newProductsSelected.push(numberC);
                }
            }
        });
        if (!isRelated && !newProductsSelected.includes(numberCode)) {
            newProductsSelected.push(numberCode);
        }

        // Use Set for O(1) add/delete/has operations instead of O(n) array methods
        const selectedSet = new Set(newProductsSelected);

        let parentSiblings = parentsIfAllChildrenSelected(selectedSet);
        while (Object.keys(parentSiblings).length > 0) {
            for (const [parentKey, siblings] of Object.entries(
                parentSiblings,
            )) {
                const parent = Number(parentKey);
                selectedSet.add(parent);
                for (const sibling of siblings) {
                    selectedSet.delete(sibling);
                }
            }
            parentSiblings = parentsIfAllChildrenSelected(selectedSet);
        }

        setProductsSelected([...selectedSet]);
    }, [code, selectedProducts, setProductsSelected]);

    if (!children.length) {
        return (
            <Checkbox
                id={`checkbox-${code}`}
                label={productTrads(name)}
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
                openVersion={openVersion}
                items={{
                    title: (
                        <Checkbox
                            id={`checkbox-${code}`}
                            label={productTrads(name)}
                            title={`Select all in ${productTrads(name)}`}
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
                                        openVersion={openVersion}
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
    const directChildren = directChildrenMap.get(parentCode) ?? [];

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

function parentsIfAllChildrenSelected(selectedSet: Set<number>): {
    [key: number]: number[];
} {
    const result: { [key: number]: number[] } = {};
    const processedParents = new Set<string>();

    for (const product of selectedSet) {
        const productCode = numberToCode.get(product);
        if (productCode === undefined) continue;

        const parentCode = productCode.split(".").slice(0, -1).join(".");

        // Skip if already processed this parent or invalid parent
        if (!parentCode || processedParents.has(parentCode)) continue;
        processedParents.add(parentCode);

        const siblings = directChildrenMap.get(parentCode) ?? [];

        // Check if all siblings are selected using Set.has() - O(1) per check
        if (siblings.every((sibling) => selectedSet.has(sibling))) {
            const parentNumberCode = codeToNumber.get(parentCode);
            if (parentNumberCode !== undefined) {
                result[parentNumberCode] = siblings;
            }
        }
    }
    return result;
}
