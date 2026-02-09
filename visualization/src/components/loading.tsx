"use client";

import { Fragment, type JSX, useEffect, useRef, useState } from "react";

interface LoadingProps {
    year: number | null;
}

export default function Loading({ year }: LoadingProps): JSX.Element {
    const oldYearRef = useRef<number | null>(null);
    const [validateYears, setValidateYears] = useState<Set<number>>(new Set());
    const timeoutsRef = useRef<Map<number, number>>(new Map());

    useEffect(() => {
        const oldYear = oldYearRef.current;
        if (year !== null || oldYearRef.current !== year) {
            oldYearRef.current = year;
        }

        if (oldYear === null) return;

        setValidateYears((prev) => new Set(prev).add(oldYear));
        oldYearRef.current = null;
        const timeoutId = window.setTimeout(() => {
            setValidateYears((prev) => {
                const newSet = new Set(prev);
                newSet.delete(oldYear);
                return newSet;
            });
            timeoutsRef.current.delete(oldYear);
        }, 3000);
        const existingTimeoutId = timeoutsRef.current.get(oldYear);
        if (existingTimeoutId !== undefined) {
            clearTimeout(existingTimeoutId);
        }
        timeoutsRef.current.set(oldYear, timeoutId);
    }, [year]);

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
    }

    return (
        <Fragment>
            {year !== null && (
                <div className="loading-container load">
                    <p>Chargement des données de {year}...</p>
                </div>
            )}
            {Array.from(validateYears).map((validatedYear, index) => (
                <div
                    key={validatedYear}
                    className="loading-container underline"
                    style={{
                        top: `${2 + (year !== null ? 3 : 0) + index * 3}rem`,
                    }}
                >
                    <p>Données de {validatedYear} chargées !</p>
                    <button
                        type="button"
                        title="Close loading"
                        aria-label="Close loading"
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
