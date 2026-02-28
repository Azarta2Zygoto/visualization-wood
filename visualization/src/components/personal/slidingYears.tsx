"use client";

import { type JSX, useEffect, useMemo, useState } from "react";

import { useHotkeys } from "react-hotkeys-hook";

import { Slider } from "@/components/ui/slider";
import metadata from "@/data/metadata.json";

const months_order = [6, 11, 1, 12, 5, 10, 4, 8, 2, 3, 9, 7] as const;
const numberOfYears = metadata.bois.end_year - metadata.bois.start_year + 1;

interface SlidingYearsProps {
    currentMonth: number;
    currentYear: number;
    isYearMode?: boolean;
    onChange: (currentMonth: number, currentYear: number) => void;
}

export default function SlidingYears({
    currentMonth,
    currentYear,
    isYearMode = false,
    onChange,
}: SlidingYearsProps): JSX.Element {
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [speed, setSpeed] = useState<number>(1000);

    useHotkeys(
        "ArrowRight",
        (event) => {
            event.preventDefault();
            changeInDate(currentMonth, currentYear, isYearMode, true, onChange);
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: false,
        },
        [currentMonth, currentYear, onChange],
    );
    useHotkeys(
        "ArrowLeft",
        (event) => {
            event.preventDefault();
            changeInDate(
                currentMonth,
                currentYear,
                isYearMode,
                false,
                onChange,
            );
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: false,
        },
        [currentMonth, currentYear, onChange],
    );

    useHotkeys(
        "Space",
        (event) => {
            event.preventDefault();
            setIsPlaying(!isPlaying);
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: false,
        },
    );

    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            changeInDate(currentMonth, currentYear, isYearMode, true, onChange);
        }, speed);
        return () => clearInterval(interval);
    }, [isPlaying, currentMonth, currentYear, isYearMode, onChange, speed]);

    const correctNumber = useMemo<number[]>(() => {
        if (currentMonth === 0) {
            return [currentYear * 12];
        }
        const monthIndex =
            months_order.indexOf(
                currentMonth as (typeof months_order)[number],
            ) - 1;
        return [currentYear * 12 + monthIndex];
    }, [currentMonth, currentYear]);

    function handleMonthSliderChange(value: number[]) {
        const monthValue = value[0] % 12;
        const yearValue = Math.floor(value[0] / 12);
        const month = months_order[monthValue] as (typeof months_order)[number];
        onChange(month, yearValue);
    }

    function handleYearSliderChange(value: number[]) {
        const yearValue = value[0];
        onChange(0, yearValue);
    }

    function handleSpeedChange(value: number) {
        if (value === 500) setSpeed(1000);
        else if (value === 1000) setSpeed(500);
    }

    return (
        <div className="slider-bar">
            <button
                className="btn btn-icon"
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? "Pause auto-play" : "Start auto-play"}
                aria-label={isPlaying ? "Pause auto-play" : "Start auto-play"}
            >
                {isPlaying ? (
                    <i className="bi bi-stop-circle-fill" />
                ) : (
                    <i className="bi bi-play-fill" />
                )}
            </button>
            <button
                className="btn btn-icon"
                onClick={() => handleSpeedChange(speed)}
                title={speed === 1000 ? "Put high speed" : "Put low speed"}
                aria-label={speed === 1000 ? "Put high speed" : "Put low speed"}
            >
                {speed === 1000 ? (
                    <i className="bi bi-fast-forward-btn-fill" />
                ) : (
                    <i className="bi bi-play-btn-fill" />
                )}
            </button>
            {isYearMode ? (
                <Slider
                    min={metadata.bois.start_year}
                    max={metadata.bois.end_year}
                    step={1}
                    value={[currentYear]}
                    onValueChange={handleYearSliderChange}
                />
            ) : (
                <Slider
                    min={metadata.bois.start_year * 12}
                    max={metadata.bois.start_year * 12 + numberOfYears * 12 - 1} // 100 years * 12 months
                    step={1}
                    value={correctNumber}
                    onValueChange={handleMonthSliderChange}
                />
            )}
        </div>
    );
}

function changeInDate(
    currentMonth: number,
    currentYear: number,
    isYearMode: boolean,
    isAdding: boolean,
    onChange: (currentMonth: number, currentYear: number) => void,
) {
    const element = isAdding ? 1 : -1;
    if (isYearMode) {
        let newYear = currentYear + element;
        if (newYear > metadata.bois.end_year) {
            newYear = metadata.bois.start_year;
        } else if (newYear < metadata.bois.start_year) {
            newYear = metadata.bois.end_year;
        }
        onChange(0, newYear);
        return;
    }

    let theMonth =
        currentMonth === 0
            ? 0
            : months_order.indexOf(
                  currentMonth as (typeof months_order)[number],
              ) + element;

    let newYear = currentYear;
    if (theMonth > 11) {
        theMonth = 0;
        newYear += 1;
    } else if (theMonth < 0) {
        theMonth = 11;
        newYear -= 1;
    }
    if (newYear > metadata.bois.end_year) {
        newYear = metadata.bois.start_year;
        theMonth = 0;
    } else if (newYear < metadata.bois.start_year) {
        newYear = metadata.bois.end_year;
        theMonth = 11;
    }
    onChange(months_order[theMonth], newYear);
}
