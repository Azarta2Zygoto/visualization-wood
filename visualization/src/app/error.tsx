"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations("ErrorPage");

    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <main className="error-main">
            <h1 className="h-secondary">{t("title")}</h1>
            <p>{t("text1")}</p>
            <div
                className="rows m-800-"
                style={{ marginTop: "1.5rem" }}
            >
                <button
                    className="btn"
                    style={{ width: 175 }}
                    onClick={() => reset()}
                >
                    {t("retry")}
                </button>
                <Link
                    href="/"
                    style={{ width: 175 }}
                    className="btn"
                >
                    {t("back-to-home")}
                </Link>
            </div>
        </main>
    );
}
