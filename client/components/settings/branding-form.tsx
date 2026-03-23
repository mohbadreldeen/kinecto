"use client";

import Image from "next/image";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import { useTenantStore } from "@/lib/store/use-tenant-store";

type Props = {
    initialLogoUrl: string | null;
    initialBrandColors: {
        primary: string;
        accent: string;
    };
};

export function BrandingForm({ initialLogoUrl, initialBrandColors }: Props) {
    const { t } = useLocale();
    const setTenantContext = useTenantStore((state) => state.setTenantContext);
    const tenantId = useTenantStore((state) => state.tenantId);
    const tenantName = useTenantStore((state) => state.tenantName);
    const role = useTenantStore((state) => state.role);

    const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
    const [primary, setPrimary] = useState(
        initialBrandColors.primary || "#0f172a"
    );
    const [accent, setAccent] = useState(
        initialBrandColors.accent || "#f59e0b"
    );
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch("/api/settings/branding", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    logoUrl: logoUrl || null,
                    brandColors: { primary, accent },
                }),
            });

            const json = (await response.json().catch(() => null)) as {
                data?: unknown;
                error?: string;
            } | null;

            if (!response.ok || !json?.data) {
                throw new Error(json?.error ?? t("settings.brandingSaveError"));
            }

            // Apply CSS variables live without page reload
            document.documentElement.style.setProperty(
                "--brand-primary",
                primary
            );
            document.documentElement.style.setProperty(
                "--brand-accent",
                accent
            );

            setTenantContext({
                tenantId,
                tenantName,
                role,
                brandColors: { primary, accent },
                logoUrl: logoUrl || null,
            });

            setMessage({ type: "success", text: t("settings.brandingSaved") });
        } catch (err) {
            setMessage({
                type: "error",
                text:
                    err instanceof Error
                        ? err.message
                        : t("settings.brandingSaveError"),
            });
        } finally {
            setSaving(false);
        }
    }

    function handleHexInput(value: string, setter: (v: string) => void) {
        if (/^#?[0-9A-Fa-f]{0,6}$/.test(value)) {
            setter(value.startsWith("#") ? value : `#${value}`);
        }
    }

    return (
        <section className="space-y-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("settings.section")}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {t("settings.brandingTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                    {t("settings.brandingSubtitle")}
                </p>
            </div>

            {/* Live preview */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
                <div
                    className="flex h-12 items-center gap-3 px-4"
                    style={{ backgroundColor: primary }}
                >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20 text-xs font-bold text-white">
                        {(tenantName ?? "K").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-white">
                        {tenantName ?? t("settings.yourBusiness")}
                    </span>
                    <div
                        className="ml-auto rounded-full px-3 py-0.5 text-xs font-bold text-slate-900"
                        style={{ backgroundColor: accent }}
                    >
                        {t("settings.actionLabel")}
                    </div>
                </div>
                <p className="px-4 py-2.5 text-xs text-slate-500">
                    {t("settings.previewLive")}
                </p>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
                {/* Primary color */}
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t("settings.primaryColor")}
                    </label>
                    <p className="mb-2 text-xs text-slate-500">
                        {t("settings.primaryColorHelp")}
                    </p>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={primary}
                            onChange={(e) => setPrimary(e.target.value)}
                            className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 p-0.5"
                        />
                        <input
                            type="text"
                            value={primary}
                            onChange={(e) =>
                                handleHexInput(e.target.value, setPrimary)
                            }
                            maxLength={7}
                            className="w-28 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                    </div>
                </div>

                {/* Accent color */}
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t("settings.accentColor")}
                    </label>
                    <p className="mb-2 text-xs text-slate-500">
                        {t("settings.accentColorHelp")}
                    </p>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={accent}
                            onChange={(e) => setAccent(e.target.value)}
                            className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 p-0.5"
                        />
                        <input
                            type="text"
                            value={accent}
                            onChange={(e) =>
                                handleHexInput(e.target.value, setAccent)
                            }
                            maxLength={7}
                            className="w-28 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                    </div>
                </div>

                {/* Logo URL */}
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t("settings.logoUrl")}{" "}
                        <span className="text-slate-400">
                            ({t("common.optional")})
                        </span>
                    </label>
                    <p className="mb-2 text-xs text-slate-500">
                        {t("settings.logoUrlHelp")}
                    </p>
                    <div className="flex items-center gap-3">
                        {logoUrl && (
                            <Image
                                src={logoUrl}
                                alt={t("settings.logoPreviewAlt")}
                                width={40}
                                height={40}
                                unoptimized
                                className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                                onError={(e) => {
                                    (
                                        e.currentTarget as HTMLImageElement
                                    ).style.display = "none";
                                }}
                            />
                        )}
                        <input
                            type="url"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                    </div>
                </div>

                {message && (
                    <div
                        className={`rounded-lg border px-4 py-3 text-sm ${
                            message.type === "success"
                                ? "border-green-200 bg-green-50 text-green-800"
                                : "border-red-200 bg-red-50 text-red-800"
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                    {saving ? t("settings.saving") : t("settings.saveBranding")}
                </button>
            </form>
        </section>
    );
}
