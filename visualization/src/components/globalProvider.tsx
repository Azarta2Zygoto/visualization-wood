"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const defaultLocale = "fr";
const locales = ["fr"];

const GlobalContext = createContext<{
    locale: string;
    setLocale: (v: string) => void;
    windowSize: { width: number; height: number };
    setWindowSize: (size: { width: number; height: number }) => void;
    allowArrowScroll: boolean;
    setAllowArrowScroll: (v: boolean) => void;
}>({
    locale: defaultLocale,
    setLocale: () => {},
    windowSize: { width: 0, height: 0 },
    setWindowSize: () => {},
    allowArrowScroll: true,
    setAllowArrowScroll: () => {},
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
    const [allowArrowScroll, setAllowArrowScroll] = useState(true);

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

    return (
        <GlobalContext.Provider
            value={{
                locale,
                setLocale,
                windowSize,
                setWindowSize,
                allowArrowScroll,
                setAllowArrowScroll,
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobal = () => useContext(GlobalContext);
