"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect } from "react";

import { SHOW_INTRO_STORAGE_KEY } from "@/metadata/constants";

import Checkbox from "./personal/checkbox";

interface IntroComponentProps {
    isOpen: boolean;
    isOpenDefault: boolean;
    onClose: () => void;
    setShowIntro: (bool: boolean) => void;
}

export default function IntroComponent({
    isOpen,
    isOpenDefault,
    onClose,
    setShowIntro,
}: IntroComponentProps): JSX.Element {
    const t = useTranslations("IntroComponent");

    function handleShowIntroChange(checked: boolean) {
        localStorage.setItem(SHOW_INTRO_STORAGE_KEY, checked.toString());
        setShowIntro(checked);
    }

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if ((e.key === "Escape" || e.key === "Backspace") && isOpen)
                onClose();
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    return (
        <Fragment>
            <div
                className="overlay"
                onClick={onClose}
                style={{ display: isOpen ? "block" : "none" }}
                aria-hidden
                role="presentation"
            />
            <div
                className="intro-component"
                role="dialog"
                aria-modal="true"
                aria-hidden={!isOpen}
                aria-label={t("intro")}
                style={{
                    transform: isOpen
                        ? "translate(-50%, -50%) scale(1)"
                        : "translate(-50%, -50%) scale(0.75)",
                    opacity: isOpen ? 1 : 0,
                    zIndex: isOpen ? 10 : -1,
                }}
            >
                <h2 className="h-secondary">{t("title")}</h2>
                <section>
                    <p>{t("description")}</p>
                    <h3 className="h-tertiary">{t("world-map")}</h3>
                    <p>{t("world-map-desc")}</p>
                    <ul>
                        <li>{t("world-map-country")}</li>
                        <li>{t("world-map-continent")}</li>
                    </ul>
                    <h3 className="h-tertiary">{t("export")}</h3>
                    <p>{t("export-desc")}</p>
                    <h3 className="h-tertiary">{t("date")}</h3>
                    <p>{t("date-desc")}</p>
                    <p>
                        <strong style={{ color: "#f00" }}>
                            {t("attention")}
                        </strong>
                        {t("date-load")}
                    </p>
                    <h3 className="h-tertiary">{t("product")}</h3>
                    <p>{t("product-desc")}</p>
                    <h3 className="h-tertiary">{t("historic")}</h3>
                    <p>{t("historic-desc")}</p>
                    <h3 className="h-tertiary">{t("param")}</h3>
                    <p>{t("param-desc")}</p>
                    <ul>
                        <li>{t("param-desc-theme")}</li>
                        <li>{t("param-desc-lang")}</li>
                        <li>{t("param-desc-definition")}</li>
                        <li>{t("param-desc-projection")}</li>
                        <li>{t("param-desc-static")}</li>
                        <li>{t("param-desc-color")}</li>
                        <li>{t("param-desc-daltonian")}</li>
                    </ul>
                </section>
                <Checkbox
                    id="show-again-checkbox"
                    label={t("show-again")}
                    checked={isOpenDefault}
                    onChange={(e) => handleShowIntroChange(e.target.checked)}
                />
                <button
                    className="btn"
                    onClick={onClose}
                    type="button"
                    style={{ width: "fit-content", margin: "0 auto" }}
                >
                    {t("close")}
                </button>
            </div>
        </Fragment>
    );
}
