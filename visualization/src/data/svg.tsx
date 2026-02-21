import type { JSX, ReactNode } from "react";

interface SvgProps {
    height?: string | number;
    width?: string | number;
    fill?: string;
    arialLabel?: string;
    title?: string;
}

interface IconSVGProps extends SvgProps {
    viewBox?: string;
    children: ReactNode;
}

export function IconSVG({
    height,
    width,
    fill,
    arialLabel,
    title,
    children,
    viewBox = "0 0 24 24",
}: IconSVGProps): JSX.Element {
    return (
        <svg
            height={height}
            width={width}
            viewBox={viewBox}
            xmlns="http://www.w3.org/2000/svg"
            focusable="false"
            fill={fill}
            role="img"
            arial-label={arialLabel}
        >
            {title && <title>{title}</title>}
            {children}
        </svg>
    );
}

export function FranceFlag(props: SvgProps): JSX.Element {
    const defaults = {
        height: 24,
        width: 36,
        arialLabel: "France Flag",
        viewBox: "0 0 3 2",
    };
    return (
        <IconSVG
            {...defaults}
            {...props}
        >
            <rect
                width="1"
                height="2"
                fill="#000091"
            />
            <rect
                x="1"
                width="1"
                height="2"
                fill="#FFF"
            />
            <rect
                x="2"
                width="1"
                height="2"
                fill="#E1000F"
            />
        </IconSVG>
    );
}

export function UKFlag(props: SvgProps): JSX.Element {
    const defaults = {
        height: 18,
        width: 30,
        arialLabel: "United Kingdom Flag",
        viewBox: "0 0 50 30",
    };
    return (
        <IconSVG
            {...defaults}
            {...props}
        >
            <clipPath id="t">
                <path d="M25,15h25v15zv15h-25zh-25v-15zv-15h25z" />
            </clipPath>
            <path
                d="M0,0v30h50v-30z"
                fill="#012169"
            />
            <path
                d="M0,0 50,30M50,0 0,30"
                stroke="#fff"
                strokeWidth="6"
            />
            <path
                d="M0,0 50,30M50,0 0,30"
                clipPath="url(#t)"
                stroke="#C8102E"
                strokeWidth="4"
            />
            <path
                d="M-1 11h22v-12h8v12h22v8h-22v12h-8v-12h-22z"
                fill="#C8102E"
                stroke="#FFF"
                strokeWidth="2"
            />
        </IconSVG>
    );
}
