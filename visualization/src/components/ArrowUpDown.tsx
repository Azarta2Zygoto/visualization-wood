"use client";

import { useTranslations } from "next-intl";
import { type JSX, useCallback, useEffect, useState } from "react";

import { useHotkeys } from "react-hotkeys-hook";

import { useGlobal } from "./globalProvider";

function getScrollState() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScrollTop =
        document.documentElement.scrollHeight - window.innerHeight;
    const threshold = 10; // Threshold in pixels to consider as "can scroll"

    return {
        canScrollUp: scrollTop > threshold,
        canScrollDown: scrollTop < maxScrollTop - threshold,
    };
}

function getScrollDelta() {
    return Math.floor(window.innerHeight);
}

export default function ArrowUpDown(): JSX.Element {
    const { allowArrowScroll } = useGlobal();
    const t = useTranslations("ArrowUpDown");

    const [{ canScrollUp, canScrollDown }, setScrollState] = useState(() => ({
        canScrollUp: false,
        canScrollDown: false,
    }));

    const handleScrollUp = useCallback(() => {
        window.scrollBy({
            top: -getScrollDelta(),
            behavior: "smooth",
        });
    }, []);

    const handleScrollDown = useCallback(() => {
        window.scrollBy({
            top: getScrollDelta(),
            behavior: "smooth",
        });
    }, []);

    useHotkeys(
        "ArrowUp",
        (event) => {
            if (!allowArrowScroll || !canScrollUp) return;
            event.preventDefault();
            handleScrollUp();
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: true,
        },
        [allowArrowScroll, canScrollUp, handleScrollUp],
    );

    useHotkeys(
        "ArrowDown",
        (event) => {
            if (!allowArrowScroll || !canScrollDown) return;
            event.preventDefault();
            handleScrollDown();
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: true,
        },
        [allowArrowScroll, canScrollDown, handleScrollDown],
    );

    useEffect(() => {
        let frame = 0;

        const updateState = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                setScrollState(getScrollState());
            });
        };

        updateState();
        window.addEventListener("scroll", updateState, { passive: true });
        window.addEventListener("resize", updateState);

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", updateState);
            window.removeEventListener("resize", updateState);
        };
    }, []);

    return (
        <div className="scroll-arrows">
            <button
                className="btn scroll-arrow-btn"
                type="button"
                aria-label={t("scroll-up")}
                title={t("scroll-up")}
                onClick={handleScrollUp}
                disabled={!canScrollUp}
            >
                <i
                    className="bi bi-arrow-up"
                    aria-hidden="true"
                />
            </button>
            <button
                className="btn scroll-arrow-btn"
                type="button"
                aria-label={t("scroll-down")}
                title={t("scroll-down")}
                onClick={handleScrollDown}
                disabled={!canScrollDown}
            >
                <i
                    className="bi bi-arrow-down"
                    aria-hidden="true"
                />
            </button>
        </div>
    );
}
