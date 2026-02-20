declare module "versor" {
    function versor(
        a: [number, number],
        b: [number, number],
    ): (t: number) => [number, number];
    export default versor;
}
