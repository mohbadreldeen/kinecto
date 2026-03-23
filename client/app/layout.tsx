import type { Metadata, Viewport } from "next";
import { Cairo, Fraunces, Manrope } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const manrope = Manrope({
    variable: "--font-manrope",
    subsets: ["latin"],
});

const fraunces = Fraunces({
    variable: "--font-fraunces",
    subsets: ["latin"],
});

const cairo = Cairo({
    variable: "--font-cairo",
    subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
    title: {
        default: "Kinecto",
        template: "%s | Kinecto",
    },
    description: "Multi-tenant loyalty and customer engagement operations.",
    manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
    themeColor: "#111827",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${manrope.variable} ${fraunces.variable} ${cairo.variable} h-full antialiased`}
        >
            <body className="min-h-full bg-(--background) text-(--foreground)">
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
