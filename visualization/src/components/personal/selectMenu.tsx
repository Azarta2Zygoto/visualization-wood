"use client";

import { type CSSProperties, type JSX, useState } from "react";

import { ChevronDownIcon } from "lucide-react";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface SelectMenuProps {
    id: string;
    options: (string | { label: string; value: string | number })[];
    selectedOption: string;
    style?: CSSProperties;
    onOptionSelect: (option: string) => void;
}

export default function SelectMenu({
    id,
    options,
    selectedOption,
    style,
    onOptionSelect,
}: SelectMenuProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);

    function handleOptionSelect(option: string) {
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
                {selectedOption}
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
                            typeof option === "string" ? option : option.label
                        }
                        className={`btn btn-option ${
                            selectedOption ===
                            (typeof option === "string"
                                ? option
                                : option.label.toString())
                                ? "btn-option-selected"
                                : ""
                        }`}
                        onClick={() =>
                            handleOptionSelect(
                                typeof option === "string"
                                    ? option
                                    : option.value.toString(),
                            )
                        }
                    >
                        {typeof option === "string" ? option : option.label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}
