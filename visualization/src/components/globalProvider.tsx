/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import {
    DEFAULT_LOCALE,
    DEFAULT_THEME,
    LOCALES,
    LOCALE_STORAGE_KEY,
    type Locales,
    THEME_ATTRIBUTE,
    THEME_STORAGE_KEY,
    THEME_VALUES,
    type Themes,
} from "@/metadata/constants";

const GlobalContext = createContext<{
    locale: Locales;
    setLocale: (v: Locales) => void;
    windowSize: { width: number; height: number };
    setWindowSize: (size: { width: number; height: number }) => void;
    allowArrowScroll: boolean;
    setAllowArrowScroll: (v: boolean) => void;
    theme: Themes;
    setTheme: (v: Themes) => void;
}>({
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    windowSize: { width: 0, height: 0 },
    setWindowSize: () => {},
    allowArrowScroll: true,
    setAllowArrowScroll: () => {},
    theme: DEFAULT_THEME,
    setTheme: () => {},
});

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [locale, setLocale] = useState<Locales>(() => {
        if (typeof window === "undefined") return DEFAULT_LOCALE;

        const localeFromStorage = localStorage.getItem(LOCALE_STORAGE_KEY);
        const locales = Object.values(LOCALES);
        const isStorageSupported =
            localeFromStorage &&
            Object.keys(locales).some((lang) => lang === localeFromStorage);
        if (isStorageSupported) return localeFromStorage as Locales;

        const navigatorLang = navigator.language.split("-")[0];
        const isSupported = Object.keys(locales).some(
            (lang) => lang === navigatorLang,
        );
        const lang = isSupported ? navigatorLang : DEFAULT_LOCALE;
        return lang as Locales;
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

    const [theme, setTheme] = useState<Themes>(DEFAULT_THEME);
    const [allowArrowScroll, setAllowArrowScroll] = useState(true);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const storedTheme = localStorage.getItem(
            LOCALE_STORAGE_KEY,
        ) as Themes | null;
        const themes = Object.values(THEME_VALUES);
        if (storedTheme && themes.includes(storedTheme)) {
            setTheme(storedTheme);
            return;
        }
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;
        setTheme(prefersDark ? THEME_VALUES.DARK : THEME_VALUES.LIGHT);
    }, []);

    useEffect(() => {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }, [locale]);

    useEffect(() => {
        document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

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
