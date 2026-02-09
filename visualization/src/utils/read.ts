const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function readNpz(year: number): Promise<number[][]> {
    const url = `${basePath}/data/data_${year}.npz`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch NPZ for year ${year}: ${res.status}`);
    }

    const buffer = await res.arrayBuffer();

    // Dynamically import to avoid type issues and SSR constraints
    const fflate = await import("fflate");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const npyjsModule: any = await import("npyjs");
    const Npyjs = npyjsModule.default ?? npyjsModule;

    const files = fflate.unzipSync(new Uint8Array(buffer));
    const parser = new Npyjs();

    // If the NPZ contains multiple arrays, return the first 2D one.
    let firstMatrix: number[][] | null = null;
    const fallbackArrays: number[][] = [];

    for (const [name, data] of Object.entries(files)) {
        if (!name.endsWith(".npy")) continue;

        const parsed = await parser.parse((data as Uint8Array).buffer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arrData: any = parsed.data; // TypedArray
        const shape: number[] = parsed.shape;

        if (Array.isArray(shape) && shape.length === 2) {
            const [rows, cols] = shape;
            const flat = Array.from(arrData as Iterable<number>);
            const matrix: number[][] = new Array(rows);
            for (let r = 0; r < rows; r++) {
                matrix[r] = flat.slice(r * cols, (r + 1) * cols);
            }
            firstMatrix = matrix;
            break;
        } else {
            // Flatten 1D arrays into a single row for a consistent number[][] return.
            const flat = Array.from(arrData as Iterable<number>);
            fallbackArrays.push(flat);
        }
    }

    if (firstMatrix) return firstMatrix;
    if (fallbackArrays.length) return fallbackArrays;
    throw new Error(`No arrays found in NPZ for year ${year}`);
}
