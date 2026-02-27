"use client";

import { useTranslations } from "next-intl";
import { type JSX, useState } from "react";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import month_list from "@/data/months.json";

const months_order = [6, 11, 1, 12, 5, 10, 4, 8, 2, 3, 9, 7] as const;
interface MonthSelectorProps {
    currentMonth: number;
    setCurrentMonth: (month: number) => void;
}

export default function MonthSelector({
    currentMonth,
    setCurrentMonth,
}: MonthSelectorProps): JSX.Element {
    const t = useTranslations("MonthSelector");
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Popover
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <PopoverTrigger
                className="btn btn-select"
                id="month-selector"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    height: "40px",
                    width: "180px",
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    justifyContent: "center",
                }}
            >
                {t(
                    month_list[
                        currentMonth.toString() as keyof typeof month_list
                    ],
                )}
            </PopoverTrigger>
            <PopoverContent className="select-months-options">
                {
                    <button
                        type="button"
                        className={`btn btn-option ${currentMonth === 0 ? "btn-option-selected" : ""}`}
                        onClick={() => {
                            setCurrentMonth(0);
                            setIsOpen(false);
                        }}
                        style={{ width: "100%", justifyContent: "center" }}
                    >
                        {t("vision")}
                    </button>
                }
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "4px",
                        marginTop: "8px",
                    }}
                >
                    {months_order.map((monthId) => {
                        const month =
                            month_list[
                                monthId.toString() as keyof typeof month_list
                            ];
                        if (!month) return null;
                        return (
                            <button
                                key={monthId}
                                type="button"
                                className={`btn btn-option ${monthId === currentMonth ? "btn-option-selected" : ""}`}
                                onClick={() => {
                                    setCurrentMonth(monthId);
                                    setIsOpen(false);
                                }}
                                style={{ justifyContent: "center" }}
                            >
                                {t(month)}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
