"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const defaultLocale = "fr";
const locales = ["fr"];

const GlobalContext = createContext<{
    locale: string;
    setLocale: (v: string) => void;
}>({
    locale: defaultLocale,
    setLocale: () => {},
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

    useEffect(() => {
        localStorage.setItem("locale", locale);
    }, [locale]);

    return (
        <GlobalContext.Provider
            value={{
                locale,
                setLocale,
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobal = () => useContext(GlobalContext);
