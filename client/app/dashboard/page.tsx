import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";
import { getServerTranslator } from "@/lib/i18n/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
    const context = await requireSessionContext("owner");
    const { t } = await getServerTranslator();

    return (
        <OwnerShell context={context}>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                    <DashboardSummary />
                </div>
                <div className="space-y-6">
                    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">
                            {t("dashboard.signedInAs")}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-slate-950">
                            {context.membership.email}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                            {t("dashboard.tenantSlug")}: {context.tenant.slug}
                        </p>
                    </section>
                </div>
            </div>
        </OwnerShell>
    );
}
