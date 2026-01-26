declare module "npyjs" {
    export class Npyjs {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parse(buffer: ArrayBuffer): Promise<{ data: any; shape: number[] }>;
    }
    export default Npyjs;
}
