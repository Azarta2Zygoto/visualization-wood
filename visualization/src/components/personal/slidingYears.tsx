"use client";

import { type JSX, useMemo } from "react";

import { useHotkeys } from "react-hotkeys-hook";

import { Slider } from "@/components/ui/slider";
import metadata from "@/data/metadata.json";

const months_order = [6, 11, 1, 12, 5, 10, 4, 8, 2, 3, 9, 7] as const;
const numberOfYears = metadata.bois.end_year - metadata.bois.start_year + 1;

interface SlidingYearsProps {
    currentMonth: number;
    currentYear: number;
    onChange: (currentMonth: number, currentYear: number) => void;
}

export default function SlidingYears({
    currentMonth,
    currentYear,
    onChange,
}: SlidingYearsProps): JSX.Element {
    useHotkeys(
        "ArrowRight",
        (event) => {
            event.preventDefault();
            let theMonth =
                currentMonth === 0
                    ? 0
                    : months_order.indexOf(
                          currentMonth as (typeof months_order)[number],
                      ) + 1;
            let newYear = currentYear;
            if (theMonth > 11) {
                theMonth = 0;
                newYear += 1;
            }
            if (newYear > metadata.bois.end_year) {
                newYear = metadata.bois.start_year;
                theMonth = 0;
            }
            onChange(months_order[theMonth], newYear);
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
            let theMonth =
                currentMonth === 0
                    ? 0
                    : months_order.indexOf(
                          currentMonth as (typeof months_order)[number],
                      ) - 1;
            let newYear = currentYear;
            if (theMonth < 0) {
                theMonth = 11;
                newYear -= 1;
            }
            if (newYear < metadata.bois.start_year) {
                newYear = metadata.bois.end_year;
                theMonth = 11;
            }
            onChange(months_order[theMonth], newYear);
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: false,
        },
        [currentMonth, currentYear, onChange],
    );

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

    const handleSliderChange = (value: number[]) => {
        const monthValue = value[0] % 12;
        const yearValue = Math.floor(value[0] / 12);
        const month = months_order[monthValue] as (typeof months_order)[number];
        onChange(month, yearValue);
    };

    return (
        <div className="slider-bar">
            <Slider
                min={metadata.bois.start_year * 12}
                max={metadata.bois.start_year * 12 + numberOfYears * 12 - 1} // 100 years * 12 months
                step={1}
                value={correctNumber}
                onValueChange={handleSliderChange}
            />
        </div>
    );
}
