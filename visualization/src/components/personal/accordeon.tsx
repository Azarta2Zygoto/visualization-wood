/* eslint-disable react-hooks/set-state-in-effect */
import { JSX, useEffect, useState } from "react";

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
}

export default function Accordeon({
    name,
    items,
    color,
    isOpen = false,
}: AccordeonProps): JSX.Element {
    const allValues = Array.isArray(items)
        ? items.map((_, i) => `item-${name}-${i}`)
        : [`item-${name}-0`];

    const [openItems, setOpenItems] = useState<string[]>(
        isOpen ? allValues : [],
    );

    useEffect(() => {
        setOpenItems(isOpen ? allValues : []);
    }, [isOpen]);

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
