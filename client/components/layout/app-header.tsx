"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useLocale } from "@/lib/i18n/use-locale";

const NAV_LINKS = [
    { href: "/dashboard", labelKey: "nav.dashboard" as const },
    { href: "/campaigns", labelKey: "nav.campaigns" as const },
    { href: "/customers", labelKey: "nav.customers" as const },
    { href: "/employees", labelKey: "nav.employees" as const },
    { href: "/wallet", labelKey: "nav.wallet" as const },
];

const SETTINGS_LINKS = [
    {
        href: "/settings/integrations",
        labelKey: "settings.integrations" as const,
    },
    { href: "/settings/appearance", labelKey: "settings.appearance" as const },
];

type Props = {
    tenantName: string;
    logoUrl: string | null;
};

export function AppHeader({ tenantName, logoUrl }: Props) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { t } = useLocale();

    function isActive(href: string) {
        if (href === "/dashboard") return pathname === href;
        return pathname === href || pathname.startsWith(href + "/");
    }

    const isSettingsActive = SETTINGS_LINKS.some((l) => isActive(l.href));

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
                {/* Logo + business name */}
                <Link
                    href="/dashboard"
                    className="flex shrink-0 items-center gap-2.5"
                >
                    {logoUrl ? (
                        <Image
                            src={logoUrl}
                            alt={tenantName}
                            width={32}
                            height={32}
                            unoptimized
                            className="h-8 w-8 rounded-lg object-cover"
                        />
                    ) : (
                        <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                            style={{
                                backgroundColor:
                                    "var(--brand-primary, #0f172a)",
                            }}
                        >
                            {tenantName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="hidden text-sm font-semibold text-slate-900 sm:block">
                        {tenantName}
                    </span>
                </Link>

                {/* Desktop nav */}
                <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`button rounded-md px-3 py-2 text-sm font-medium transition ${
                                isActive(link.href)
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                        >
                            {t(link.labelKey)}
                        </Link>
                    ))}

                    {/* Settings dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen((prev) => !prev)}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                isSettingsActive
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                        >
                            {t("nav.settings")}
                            <svg
                                className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>

                        {settingsOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setSettingsOpen(false)}
                                />
                                <div className="absolute left-0 z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                    {SETTINGS_LINKS.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() =>
                                                setSettingsOpen(false)
                                            }
                                            className={`block px-4 py-2 text-sm transition ${
                                                isActive(link.href)
                                                    ? "font-semibold text-slate-900"
                                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                            }`}
                                        >
                                            {t(link.labelKey)}
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </nav>

                {/* Right side */}
                <div className="ml-auto flex items-center gap-2">
                    <div className="hidden md:block">
                        <LanguageSwitcher />
                    </div>
                    <div className="hidden md:block">
                        <SignOutButton />
                    </div>
                    {/* Mobile hamburger */}
                    <button
                        type="button"
                        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                        onClick={() => setMobileOpen((prev) => !prev)}
                        aria-label={
                            mobileOpen ? t("menu.close") : t("menu.open")
                        }
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            {mobileOpen ? (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            ) : (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile nav drawer */}
            {mobileOpen && (
                <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
                    <div className="flex flex-col gap-1">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                                    isActive(link.href)
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                {t(link.labelKey)}
                            </Link>
                        ))}
                        <div className="my-1.5 border-t border-slate-100" />
                        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t("nav.settings")}
                        </p>
                        {SETTINGS_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                                    isActive(link.href)
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                {t(link.labelKey)}
                            </Link>
                        ))}
                        <div className="my-1.5 border-t border-slate-100" />
                        <div className="px-3 py-1">
                            <LanguageSwitcher className="w-full justify-between" />
                        </div>
                        <div className="px-1">
                            <SignOutButton />
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
