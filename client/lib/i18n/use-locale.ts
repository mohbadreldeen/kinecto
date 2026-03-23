"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import {
    defaultLocale,
    localeCookieKey,
    localeCodes,
    localeStorageKey,
    type LocaleCode,
    messages,
} from "@/lib/i18n/messages";

const LOCALE_EVENT = "kinecto-locale-change";

function isLocaleCode(value: string): value is LocaleCode {
    return localeCodes.includes(value as LocaleCode);
}

function detectBrowserLocale(): LocaleCode {
    if (typeof navigator === "undefined") {
        return defaultLocale;
    }

    return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function readStoredLocale(): LocaleCode {
    if (typeof window === "undefined") {
        return defaultLocale;
    }

    const savedLocale = window.localStorage.getItem(localeStorageKey);

    if (savedLocale && isLocaleCode(savedLocale)) {
        return savedLocale;
    }

    return detectBrowserLocale();
}

function subscribe(onStoreChange: () => void) {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const handler = () => onStoreChange();
    window.addEventListener("storage", handler);
    window.addEventListener(LOCALE_EVENT, handler);

    return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(LOCALE_EVENT, handler);
    };
}

function getSnapshot() {
    return readStoredLocale();
}

function getServerSnapshot() {
    return defaultLocale;
}

export function useLocale() {
    const locale = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        document.documentElement.lang = locale;
        document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
        document.cookie = `${localeCookieKey}=${locale}; path=/; max-age=31536000; samesite=lax`;
    }, [locale]);

    const setLanguage = useCallback((value: LocaleCode) => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(localeStorageKey, value);
        window.dispatchEvent(new Event(LOCALE_EVENT));
    }, []);

    const t = useCallback(
        (key: keyof (typeof messages)["en"]) =>
            messages[locale][key] ?? messages.en[key],
        [locale]
    );

    return useMemo(
        () => ({ locale, setLanguage, t }),
        [locale, setLanguage, t]
    );
}
