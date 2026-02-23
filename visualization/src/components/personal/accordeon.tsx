/* eslint-disable react-hooks/set-state-in-effect */
import { JSX, useEffect, useMemo, useState } from "react";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface SubAccordeonItem {
    title: string | JSX.Element;
    content: JSX.Element;
}

interface AccordeonProps {
    name: string;
    items: SubAccordeonItem | Array<SubAccordeonItem>;
    color?: string;
    isOpen?: boolean;
    openVersion?: number;
}

export default function Accordeon({
    name,
    items,
    color,
    isOpen = false,
    openVersion = 0,
}: AccordeonProps): JSX.Element {
    const itemCount = Array.isArray(items) ? items.length : 1;

    const allValues = useMemo(
        () => Array.from({ length: itemCount }, (_, i) => `item-${name}-${i}`),
        [name, itemCount],
    );

    const [openItems, setOpenItems] = useState<string[]>(
        isOpen ? allValues : [],
    );

    useEffect(() => {
        setOpenItems(isOpen ? allValues : []);
    }, [isOpen, allValues, openVersion]);

    return (
        <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
            className="w-full"
        >
            {Array.isArray(items) ? (
                items.map((item, index) => (
                    <AccordionItem
                        key={index}
                        value={`item-${name}-${index}`}
                        className="accordeon"
                    >
                        <AccordionTrigger
                            className="open-accordeon"
                            style={{ display: "none" }}
                        >
                            {item.title}
                        </AccordionTrigger>
                        <AccordionContent
                            className="in-accordeon"
                            style={{ borderLeftColor: color }}
                        >
                            {item.content}
                        </AccordionContent>
                    </AccordionItem>
                ))
            ) : (
                <AccordionItem
                    value={`item-${name}-0`}
                    className="accordeon"
                >
                    <AccordionTrigger className="open-accordeon">
                        {items.title}
                    </AccordionTrigger>
                    <AccordionContent
                        className="in-accordeon"
                        style={{ borderLeftColor: color }}
                    >
                        {items.content}
                    </AccordionContent>
                </AccordionItem>
            )}
        </Accordion>
    );
}
