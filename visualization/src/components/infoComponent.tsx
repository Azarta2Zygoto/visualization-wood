"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect } from "react";

import { Github, Website } from "@/metadata/svg";

interface InfoComponentProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenIntro?: () => void;
}

export function InfoComponent({
    isOpen,
    onClose,
    onOpenIntro,
}: InfoComponentProps): JSX.Element {
    const t = useTranslations("InfoComponent");

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
                className="info-component"
                role="dialog"
                aria-modal="true"
                aria-hidden={!isOpen}
                aria-label={t("info")}
                style={{
                    transform: isOpen
                        ? "translate(-50%, -50%) scale(1)"
                        : "translate(-50%, -50%) scale(0.75)",
                    opacity: isOpen ? 1 : 0,
                    zIndex: isOpen ? 10 : -1,
                }}
            >
                <h1 className="h-secondary">{t("title")}</h1>
                <section>
                    <p>
                        {t.rich("author", {
                            strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                    </p>
                    <p>
                        {t.rich("tutor", {
                            strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                    </p>
                    <p>
                        {t.rich("cadre", {
                            strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                    </p>
                    <p>
                        {t.rich("data", {
                            strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                    </p>
                    <div className="rows">
                        <a
                            href="https://agreste.agriculture.gouv.fr/agreste-web/disaron/COMEXTBOIS/detail/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-primary"
                        >
                            <Website />
                            https://agreste.agriculture.gouv.fr/agreste-web/disaron/COMEXTBOIS/detail/
                        </a>
                    </div>
                    <p>{t("description")}</p>
                    <p>{t("code")}</p>
                    <div className="rows">
                        <a
                            href="https://github.com/Azarta2Zygoto/visualization-wood"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-primary"
                        >
                            <Github />
                            https://github.com/Azarta2Zygoto/visualization-wood
                        </a>
                    </div>
                </section>
                <button
                    className="btn"
                    onClick={onOpenIntro}
                    type="button"
                    style={{ width: "fit-content", margin: "0 auto" }}
                >
                    {t("intro")}
                </button>
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
