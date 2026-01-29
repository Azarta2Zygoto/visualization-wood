"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NotFound() {
    const t = useTranslations("NotFound");

    return (
        <main className="error-main">
            <h1 className="h-secondary">{t("title")}</h1>
            <section>
                <p>{t("text1")}</p>
                <p>{t("text2")}</p>
            </section>
            <Link
                href="/"
                className="btn"
                style={{ marginTop: "1.5rem" }}
            >
                {t("back-to-home")}
            </Link>
        </main>
    );
}
