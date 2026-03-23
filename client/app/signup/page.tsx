import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentSessionContext } from "@/lib/auth/session";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function SignupPage() {
    const { t } = await getServerTranslator();
    const context = await getCurrentSessionContext();

    if (context) {
        redirect(context.role === "employee" ? "/employee" : "/dashboard");
    }

    return (
        <main className="auth-shell">
            <section className="auth-card auth-card-wide">
                <div className="space-y-3">
                    <p className="eyebrow">{t("signup.eyebrow")}</p>
                    <h1 className="auth-title">{t("signup.title")}</h1>
                    <p className="auth-copy">{t("signup.copy")}</p>
                </div>
                <SignupForm />
            </section>
        </main>
    );
}
