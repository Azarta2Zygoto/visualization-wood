"use client";

import { type JSX, useState } from "react";

export default function ConfigBar(): JSX.Element {
    const [selectedYear, setSelectedYear] = useState<number>(2012);
    const [selectedMonth, setSelectedMonth] = useState<number>(1);

    return (
        <div className="config-bar">
            <h2 className="h2-primary">Configuration</h2>
            <label>
                Year:
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                    {Array.from({ length: 11 }, (_, i) => 2012 + i).map(
                        (year) => (
                            <option
                                key={year}
                                value={year}
                            >
                                {year}
                            </option>
                        ),
                    )}
                </select>
            </label>
            <label>
                Month:
                <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(
                        (month) => (
                            <option
                                key={month}
                                value={month}
                            >
                                {month}
                            </option>
                        ),
                    )}
                </select>
            </label>
        </div>
    );
}
