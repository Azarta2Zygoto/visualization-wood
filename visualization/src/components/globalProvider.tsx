/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import type { Themes } from "@/data/types";

const defaultLocale = "fr";
const locales = ["fr", "en"] as const;

const GlobalContext = createContext<{
    locale: string;
    setLocale: (v: string) => void;
    windowSize: { width: number; height: number };
    setWindowSize: (size: { width: number; height: number }) => void;
    allowArrowScroll: boolean;
    setAllowArrowScroll: (v: boolean) => void;
    theme: Themes;
    setTheme: (v: Themes) => void;
}>({
    locale: defaultLocale,
    setLocale: () => {},
    windowSize: { width: 0, height: 0 },
    setWindowSize: () => {},
    allowArrowScroll: true,
    setAllowArrowScroll: () => {},
    theme: "light",
    setTheme: () => {},
});

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [locale, setLocale] = useState(() => {
        if (typeof window === "undefined") return defaultLocale;

        const localeFromStorage = localStorage.getItem("locale");
        const isStorageSupported =
            localeFromStorage &&
            Object.keys(locales).some((lang) => lang === localeFromStorage);
        if (isStorageSupported) return localeFromStorage;

        const navigatorLang = navigator.language.split("-")[0];
        const isSupported = Object.keys(locales).some(
            (lang) => lang === navigatorLang,
        );
        const lang = isSupported ? navigatorLang : defaultLocale;
        return lang;
    });
    const [windowSize, setWindowSize] = useState<{
        width: number;
        height: number;
    }>(() => {
        if (typeof window === "undefined") {
            return { width: 0, height: 0 };
        }
        return { width: window.innerWidth, height: window.innerHeight };
    });

    const [theme, setTheme] = useState<Themes>("light");
    const [allowArrowScroll, setAllowArrowScroll] = useState(true);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const storedTheme = localStorage.getItem("theme") as Themes | null;
        if (
            storedTheme &&
            (storedTheme === "light" || storedTheme === "dark")
        ) {
            setTheme(storedTheme);
            return;
        }
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;
        setTheme(prefersDark ? "dark" : "light");
    }, []);

    useEffect(() => {
        localStorage.setItem("locale", locale);
    }, [locale]);

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    return (
        <GlobalContext.Provider
            value={{
                locale,
                setLocale,
                windowSize,
                setWindowSize,
                allowArrowScroll,
                setAllowArrowScroll,
                theme,
                setTheme,
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobal = () => useContext(GlobalContext);
