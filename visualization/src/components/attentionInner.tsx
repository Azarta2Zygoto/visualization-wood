"use client";

import { useTranslations } from "next-intl";
import { type JSX, useEffect, useState } from "react";

import { createPortal } from "react-dom";

interface AttentionInnerProps {
    text: string;
    isOpen: boolean;
    hasBeenClosed?: () => void;
}

export default function AttentionInner({
    text,
    isOpen,
    hasBeenClosed,
}: AttentionInnerProps): JSX.Element | null {
    const t = useTranslations("DefaultTexts");

    const [isVisible, setIsVisible] = useState<boolean>(isOpen);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setIsVisible(isOpen);
    }, [isOpen]);

    function handleClose() {
        setIsVisible(false);
        if (hasBeenClosed) {
            hasBeenClosed();
        }
    }

    const content = (
        <div
            className="attention-inner"
            style={{ display: isVisible ? "flex" : "none" }}
        >
            <div className="attention-header">
                <p className="attention-text">{t("attention")}</p>
                <button
                    className="btn"
                    title={t("close-desc")}
                    aria-label={t("close-desc")}
                    onClick={handleClose}
                >
                    &times;
                </button>
            </div>
            <p>{text}</p>
        </div>
    );

    // Render into document.body so position:fixed is relative to viewport
    if (!mounted) return null;
    return createPortal(content, document.body);
}
