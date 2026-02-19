"use client";

import { useTranslations } from "next-intl";
import { JSX, useState } from "react";

import { ChevronDownIcon } from "lucide-react";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { FranceFlag, UKFlag } from "@/data/svg";

import { useGlobal } from "../globalProvider";

interface FlagSelectMenuProps {
    options: string[];
    selectedOption: string;
}

export default function FlagSelectMenu({
    options,
    selectedOption,
}: FlagSelectMenuProps): JSX.Element {
    const t = useTranslations("DefaultTexts");
    const { setLocale } = useGlobal();

    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <PopoverTrigger
                className="btn btn-select"
                id="locale-select-menu"
                onClick={() => setIsOpen(!isOpen)}
                style={{ height: "40px", width: "80px" }}
                aria-label={t("selectLanguage")}
            >
                {chooseFlag(selectedOption)}
                <ChevronDownIcon
                    className={`pointer-events-none size-4 translate-y-0.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    style={{ marginBottom: "4px" }}
                />
            </PopoverTrigger>
            <PopoverContent className="select-menu-options">
                {options.map((option, i) => (
                    <button
                        key={i}
                        className={`btn btn-option ${
                            selectedOption === option
                                ? "btn-option-selected"
                                : ""
                        }`}
                        aria-label={option}
                        onClick={() => setLocale(option)}
                    >
                        {chooseFlag(option)}
                        {t(option)}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}

function chooseFlag(countryCode: string): JSX.Element {
    switch (countryCode) {
        case "fr":
            return (
                <FranceFlag
                    width={30}
                    height={20}
                />
            );
        case "en":
            return <UKFlag />;
        default:
            return <></>;
    }
}
