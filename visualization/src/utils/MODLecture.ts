import products from "@/data/products.json";

export interface MODdataOutType {
    name: string;
    code: string;
    [key: string]: MODdataOutType | string;
}

export interface MODdataInType {
    name: string;
    code: string;
}

export function processMODData(data: {
    [key: string]: MODdataInType;
}): MODdataOutType {
    const ordering: { [length: number]: { [key: string]: MODdataInType }[] } =
        {};

    Object.keys(data).forEach((key) => {
        const code = data[key].code;
        const length = code.split(".").length;

        if (!ordering[length]) {
            ordering[length] = [];
        }

        const element = { [key]: data[key] };
        ordering[length].push(element);
    });

    const sortedKeys = Object.keys(ordering)
        .map(Number)
        .sort((a, b) => a - b);

    const result: MODdataOutType = { name: "root", code: "root" };

    sortedKeys.forEach((length) => {
        ordering[length].forEach((element) => {
            const key = Object.keys(element)[0];
            const value = element[key];
            const codeParts = value.code.split(".");
            let currentLevel = result;

            codeParts.forEach((part, index) => {
                if (index === codeParts.length - 1) {
                    currentLevel[part] = {
                        name: value.name,
                        code: value.code,
                    } as MODdataOutType;
                }
                if (index < codeParts.length - 1) {
                    currentLevel = currentLevel[part] as MODdataOutType;
                }
            });
        });
    });

    return result;
}

export function hasChild(productNumberCode: number): boolean {
    const productCode =
        products[String(productNumberCode) as keyof typeof products].code;

    if (!productCode && productCode !== "0") return false;
    const allProductCodes = Object.values(products).map((p) => p.code);
    let hasChild = false;
    allProductCodes.forEach((code) => {
        if (code.startsWith(productCode + ".")) {
            hasChild = true;
        }
    });
    return hasChild;
}

export function getAllChildren(productNumberCode: number): number[] {
    const productCode =
        products[String(productNumberCode) as keyof typeof products].code;
    if (!productCode) return [];

    const selfDepth = productCode.split(".").length;
    const result: number[] = [];
    Object.keys(products).forEach((NumberCode) => {
        const code = products[NumberCode as keyof typeof products].code;
        if (
            code.startsWith(productCode + ".") &&
            code.split(".").length === selfDepth + 1
        ) {
            result.push(Number(NumberCode));
        }
    });
    return result;
}

export function calculateNBSingleElementSelected(
    productsSelected: number[],
): number {
    let nbSingleElementSelected = 0;
    productsSelected.forEach((productIndex) => {
        if (hasChild(productIndex)) {
            const children = getAllChildren(productIndex);
            nbSingleElementSelected +=
                calculateNBSingleElementSelected(children);
        } else {
            nbSingleElementSelected++;
        }
    });
    return nbSingleElementSelected;
}

export const NBMaxElement = calculateNBSingleElementSelected([0]);
