"use client";

import { useTranslations } from "next-intl";
import { Fragment, type JSX, useEffect, useRef, useState } from "react";

interface LoadingProps {
    yearLoading: Set<number>;
}

export default function Loading({ yearLoading }: LoadingProps): JSX.Element {
    const t = useTranslations("Loading");

    const previousLoadingRef = useRef<Set<number>>(new Set());
    const timeoutsRef = useRef<Map<number, number>>(new Map());
    const [validateYears, setValidateYears] = useState<Set<number>>(new Set());

    useEffect(() => {
        const previousLoading = previousLoadingRef.current;
        const removedYears = Array.from(previousLoading).filter(
            (value) => !yearLoading.has(value),
        );

        removedYears.forEach((year) => {
            setValidateYears((prev) => new Set(prev).add(year));
            const existingTimeoutId = timeoutsRef.current.get(year);
            if (existingTimeoutId !== undefined) {
                clearTimeout(existingTimeoutId);
            }
            const timeoutId = window.setTimeout(() => {
                setValidateYears((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(year);
                    return newSet;
                });
                timeoutsRef.current.delete(year);
            }, 3000);
            timeoutsRef.current.set(year, timeoutId);
        });

        previousLoadingRef.current = new Set(yearLoading);
    }, [yearLoading]);

    useEffect(() => {
        const timeouts = timeoutsRef.current;

        return () => {
            timeouts.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            timeouts.clear();
        };
    }, []);

    function handleClose(yearToRemove: number) {
        setValidateYears((prev) => {
            const newSet = new Set(prev);
            newSet.delete(yearToRemove);
            return newSet;
        });

        const existingTimeoutId = timeoutsRef.current.get(yearToRemove);
        if (existingTimeoutId !== undefined) {
            clearTimeout(existingTimeoutId);
            timeoutsRef.current.delete(yearToRemove);
        }
    }

    return (
        <Fragment>
            {Array.from(yearLoading)
                .sort((a, b) => b - a)
                .slice(-3)
                .map((year, index) => (
                    <div
                        key={year}
                        className="loading-container load"
                        style={{ top: `${1.5 + index * 3}rem` }}
                    >
                        <p>{t("loading", { year: year })}</p>
                    </div>
                ))}
            {Array.from(validateYears)
                .sort((a, b) => b - a)
                .slice(-3)
                .map((validatedYear, index) => (
                    <div
                        key={validatedYear}
                        className="loading-container underline"
                        style={{
                            top: `${1.5 + 3 * Math.min(yearLoading.size, 3) + index * 3}rem`,
                        }}
                    >
                        <p>{t("loaded", { year: validatedYear })}</p>
                        <button
                            type="button"
                            title={t("close")}
                            aria-label={t("close")}
                            className="btn-icon"
                            onClick={() => handleClose(validatedYear)}
                        >
                            <i className="bi bi-x-circle-fill" />
                        </button>
                    </div>
                ))}
        </Fragment>
    );
}
