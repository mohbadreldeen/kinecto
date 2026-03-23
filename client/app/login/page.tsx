import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import {
    getCurrentSessionContext,
    getInactiveSessionNotice,
} from "@/lib/auth/session";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function LoginPage() {
    const { t } = await getServerTranslator();
    const context = await getCurrentSessionContext();

    if (context) {
        redirect(context.role === "employee" ? "/employee" : "/dashboard");
    }

    const inactiveNotice = await getInactiveSessionNotice(
        t("auth.inactiveNotice")
    );

    return (
        <main className="auth-shell">
            <section className="auth-card">
                <div className="space-y-3">
                    <p className="eyebrow">Kinecto</p>
                    <h1 className="auth-title">{t("login.title")}</h1>
                    <p className="auth-copy">{t("login.copy")}</p>
                </div>
                <LoginForm inactiveNotice={inactiveNotice} />
            </section>
        </main>
    );
}
