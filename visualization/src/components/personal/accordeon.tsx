import { JSX } from "react";

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
    items: SubAccordeonItem | Array<SubAccordeonItem>;
    color?: string;
}

export default function Accordeon({
    items,
    color,
}: AccordeonProps): JSX.Element {
    return (
        <Accordion
            type="single"
            collapsible
            className="w-full"
        >
            {Array.isArray(items) ? (
                items.map((item, index) => (
                    <AccordionItem
                        key={index}
                        value={`item-${index}`}
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
                    value="item-0"
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
