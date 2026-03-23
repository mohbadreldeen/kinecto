"use client";

import type { LocaleCode } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/use-locale";

type Props = {
    className?: string;
};

export function LanguageSwitcher({ className = "" }: Props) {
    const { locale, setLanguage, t } = useLocale();

    return (
        <label className={`inline-flex items-center gap-2 ${className}`.trim()}>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("language.label")}
            </span>
            <select
                value={locale}
                onChange={(event) =>
                    setLanguage(event.target.value as LocaleCode)
                }
                aria-label={t("language.label")}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none transition focus:border-(--brand-accent)"
            >
                <option value="en">{t("language.english")}</option>
                <option value="ar">{t("language.arabic")}</option>
            </select>
        </label>
    );
}
