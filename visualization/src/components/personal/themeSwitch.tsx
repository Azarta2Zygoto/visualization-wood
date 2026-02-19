"use client";

import { useTranslations } from "next-intl";
import { JSX } from "react";

import { useGlobal } from "@/components/globalProvider";
import { Switch } from "@/components/ui/switch";

export default function ThemeSwitch(): JSX.Element {
    const t = useTranslations("DefaultTexts");
    const { theme, setTheme } = useGlobal();

    return (
        <Switch
            checked={theme === "dark"}
            onCheckedChange={(isDark) => setTheme(isDark ? "dark" : "light")}
            className="theme-switch"
            aria-label={t("switch-theme")}
            title={t("switch-theme")}
            symbol={theme === "dark" ? "🌙" : "☀️"}
        />
    );
}
