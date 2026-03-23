import { cookies } from "next/headers";

import {
    defaultLocale,
    localeCodes,
    localeCookieKey,
    messages,
    type LocaleCode,
} from "@/lib/i18n/messages";

function isLocaleCode(value: string): value is LocaleCode {
    return localeCodes.includes(value as LocaleCode);
}

export async function getServerLocale(): Promise<LocaleCode> {
    const cookieStore = await cookies();
    const localeFromCookie = cookieStore.get(localeCookieKey)?.value ?? "";

    return isLocaleCode(localeFromCookie) ? localeFromCookie : defaultLocale;
}

export async function getServerTranslator() {
    const locale = await getServerLocale();

    return {
        locale,
        t: (key: keyof (typeof messages)["en"]) =>
            messages[locale][key] ?? messages.en[key],
    };
}
