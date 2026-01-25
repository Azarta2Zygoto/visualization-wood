"use client";

import { type Formats, NextIntlClientProvider } from "next-intl";
import React, { useEffect, useState } from "react";

import { useGlobal } from "@/components/globalProvider";

import french from "../../messages/fr.json";

export const formats = {
    number: {
        euro: {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 2,
        },
    },
} satisfies Formats;

export default function IntlProvider({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { locale } = useGlobal();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [messages, setMessages] = useState<any>(french);

    useEffect(() => {
        async function loadMessages() {
            if (locale) {
                const msgs = (await import(`../../messages/${locale}.json`))
                    .default;
                setMessages(msgs);
            }
        }

        loadMessages();
    }, [locale]);

    return (
        <NextIntlClientProvider
            locale={locale}
            messages={messages}
            formats={formats}
            timeZone="Europe/Paris"
        >
            <html lang={locale}>
                <body>{children}</body>
            </html>
        </NextIntlClientProvider>
    );
}
