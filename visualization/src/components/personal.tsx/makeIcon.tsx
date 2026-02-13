"use client";

import { type JSX } from "react";

import icon_symbole from "@/data/symboles.json";

interface MakeIconProps {
    name: string;
    width?: number;
    height?: number;
}

interface IconData {
    viewBox: string;
    path: string;
    fill: string;
    stroke?: string;
    "stroke-width"?: number;
    linecap?: string;
    linejoin?: string;
    transform?: string;
}

export default function MakeIcon({
    name,
    width = 25,
    height = 25,
}: MakeIconProps): JSX.Element {
    const setIcon = new Set(Object.keys(icon_symbole));

    if (!setIcon.has(name)) return <></>;
    const correct_name = name as keyof typeof icon_symbole;
    const correct_icon = icon_symbole[correct_name] as IconData;

    return (
        <svg
            viewBox={correct_icon.viewBox}
            width={width}
            height={height}
        >
            <path
                d={correct_icon.path}
                fill={correct_icon.fill}
                stroke={correct_icon.stroke ?? undefined}
                strokeWidth={correct_icon["stroke-width"]}
                strokeLinecap={correct_icon.linecap as "butt" | "round" | "square" | "inherit" | undefined}
                strokeLinejoin={correct_icon.linejoin as "miter" | "round" | "bevel" | "inherit" | undefined}
                transform={correct_icon.transform}
            />
        </svg>
    );
}
