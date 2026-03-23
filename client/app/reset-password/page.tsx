import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function ResetPasswordPage() {
    const { t } = await getServerTranslator();

    return (
        <main className="auth-shell">
            <section className="auth-card">
                <div className="space-y-3">
                    <p className="eyebrow">{t("reset.eyebrow")}</p>
                    <h1 className="auth-title">{t("reset.title")}</h1>
                    <p className="auth-copy">{t("reset.copy")}</p>
                </div>
                <ResetPasswordForm />
            </section>
        </main>
    );
}
