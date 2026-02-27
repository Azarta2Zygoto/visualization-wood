"use client";

import { type CSSProperties, type JSX, useState } from "react";

import NumberFlow from "@number-flow/react";
import { ChevronDownIcon } from "lucide-react";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface NumberSelectMenuProps {
    id: string;
    options: (number | { label: string; value: number })[];
    selectedOption: number;
    style?: CSSProperties;
    onOptionSelect: (option: number) => void;
}

export default function NumberSelectMenu({
    id,
    options,
    selectedOption,
    style,
    onOptionSelect,
}: NumberSelectMenuProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);

    function handleOptionSelect(option: number) {
        if (option !== selectedOption) {
            onOptionSelect(option);
        }
        setIsOpen(false);
    }

    return (
        <Popover
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <PopoverTrigger
                className="btn btn-select"
                id={id}
                onClick={() => setIsOpen(!isOpen)}
                style={{ ...style, height: "40px" }}
            >
                <NumberFlow
                    value={selectedOption}
                    format={{ useGrouping: false }}
                />
                <ChevronDownIcon
                    className={`pointer-events-none size-4 translate-y-0.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    style={{ marginBottom: "4px" }}
                />
            </PopoverTrigger>
            <PopoverContent className="select-menu-options">
                {options.map((option, i) => (
                    <button
                        key={i}
                        type="button"
                        aria-label={
                            typeof option === "number"
                                ? option.toString()
                                : option.label.toString()
                        }
                        className={`btn btn-option ${
                            selectedOption ===
                            (typeof option === "number"
                                ? option
                                : option.label.toString())
                                ? "btn-option-selected"
                                : ""
                        }`}
                        onClick={() =>
                            handleOptionSelect(
                                typeof option === "number"
                                    ? option
                                    : option.value,
                            )
                        }
                    >
                        {typeof option === "number" ? option : option.label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}
