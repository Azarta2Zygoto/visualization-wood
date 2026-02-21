import type { Metadata, Viewport } from "next";

import { GlobalProvider } from "@/components/globalProvider";

import "./globals.css";
import IntlProvider from "./intlProvider";

const BASE = "https://azarta2zygoto.github.io/visualization-wood/";

export const metadata: Metadata = {
    metadataBase: new URL(BASE),
    title: "Visualization",
    description: "Visualization of export data between France and the world",
    icons: {
        icon: "/visualization-wood/logo.png",
        shortcut: "/visualization-wood/logo.png",
        apple: "/visualization-wood/logo.png",
    },
    openGraph: {
        title: "Visualization",
        description:
            "Visualization of export data between France and the world",
        url: "/",
        images: "/logo.png",
        type: "website",
        siteName: "Visualization",
        locale: "fr_FR",
    },
    twitter: {
        card: "summary_large_image",
        title: "Visualization",
        description:
            "Visualization of export data between France and the world",
        images: "/logo.png",
    },
    authors: [
        {
            name: "Clément Petitjean",
        },
        {
            name: "Quentin Potiron",
            url: "visualization-wood/.well-known/humans.txt",
        },
    ],
    keywords: [
        "visualization",
        "interactive",
        "globe",
        "export",
        "wood",
        "data",
        "France",
    ],
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#F3EDE6",
    colorScheme: "light",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <GlobalProvider>
            <IntlProvider>{children}</IntlProvider>
        </GlobalProvider>
    );
}
