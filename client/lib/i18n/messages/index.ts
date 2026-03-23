import { arMessages } from "./ar";
import { enMessages } from "./en";
import type { MessageCatalog } from "./types";

export const localeCodes = ["en", "ar"] as const;
export type LocaleCode = (typeof localeCodes)[number];

export const defaultLocale: LocaleCode = "en";
export const localeStorageKey = "kinecto.locale";
export const localeCookieKey = "kinecto-locale";

export const messages: Record<LocaleCode, MessageCatalog> = {
    en: enMessages,
    ar: arMessages,
};
