export function calculateArrowHead(
    d: {
        arcPoints: [number, number][];
        value: number;
    },
    arrowheadSize: number,
    maxValue: number,
): string {
    if (d.arcPoints.length < 2) return "";

    const end = d.arcPoints[d.arcPoints.length - 1];
    const prev = d.arcPoints[d.arcPoints.length - 2];

    // Calculate angle for arrowhead rotation
    const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);

    // Create arrowhead triangle points
    const size = 3 + arrowheadSize * (d.value / maxValue) ** 0.5; // Scale size by value (sqrt for better visual distribution)
    const tipX = end[0];
    const tipY = end[1];

    // Point 1: tip of arrow
    const p1X = tipX + size * Math.cos(angle);
    const p1Y = tipY + size * Math.sin(angle);

    // Point 2: left side of arrow base
    const p2X = end[0] - size * Math.cos(angle - Math.PI / 6);
    const p2Y = end[1] - size * Math.sin(angle - Math.PI / 6);

    // Point 3: right side of arrow base
    const p3X = end[0] - size * Math.cos(angle + Math.PI / 6);
    const p3Y = end[1] - size * Math.sin(angle + Math.PI / 6);

    return `M${p1X},${p1Y}L${p2X},${p2Y}L${p3X},${p3Y}Z`;
}
