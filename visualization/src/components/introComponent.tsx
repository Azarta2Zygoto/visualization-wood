"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect } from "react";

interface IntroComponentProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function IntroComponent({
    isOpen,
    onClose,
}: IntroComponentProps): JSX.Element {
    const t = useTranslations("IntroComponent");

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
                aria-label={t("info")}
                style={{
                    transform: isOpen
                        ? "translate(-50%, -50%) scale(1)"
                        : "translate(-50%, -50%) scale(0.75)",
                    opacity: isOpen ? 1 : 0,
                    zIndex: isOpen ? 10 : -1,
                }}
            ></div>
        </Fragment>
    );
}
