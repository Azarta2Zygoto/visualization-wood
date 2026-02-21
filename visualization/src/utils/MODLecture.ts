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
