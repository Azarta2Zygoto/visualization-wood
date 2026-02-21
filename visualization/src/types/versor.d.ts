declare module "versor" {
    function versor(
        r: [number, number, number],
    ): [number, number, number, number];
    namespace versor {
        // Convert 2D lat/lon to 3D cartesian coordinates
        function cartesian(
            a: [number, number] | [number, number, number],
        ): [number, number, number];

        // Compute the quaternion delta between two 3D vectors
        function delta(
            a: [number, number, number],
            b: [number, number, number],
        ): [number, number, number, number];

        // Multiply two quaternions
        function multiply(
            a: [number, number, number, number],
            b: [number, number, number, number],
        ): [number, number, number, number];

        // Convert quaternion to euler angles (rotation array)
        function rotation(
            q: [number, number, number, number],
        ): [number, number, number];
    }

    export default versor;
}
