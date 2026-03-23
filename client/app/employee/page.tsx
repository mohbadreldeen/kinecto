import { SignOutButton } from "@/components/auth/sign-out-button";
import { CustomerSearchPanel } from "@/components/employee/customer-search-panel";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { TenantStoreSync } from "@/components/providers/tenant-store-sync";
import { requireSessionContext } from "@/lib/auth/session";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function EmployeePage() {
    const context = await requireSessionContext("employee");
    const { t } = await getServerTranslator();

    return (
        <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-10 text-slate-950">
            <TenantStoreSync
                tenantId={context.tenant.id}
                tenantName={context.tenant.name}
                role={context.role}
                brandColors={
                    (context.tenant.brandColors ?? {}) as Record<string, string>
                }
                logoUrl={context.tenant.logoUrl}
            />
            <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                <div className="flex flex-col gap-4 rounded-4xl border border-slate-200 bg-white p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3">
                        <p className="eyebrow">
                            {t("employee.workspaceEyebrow")}
                        </p>
                        <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                            {t("employee.frontlineModeFor")}{" "}
                            {context.tenant.name}
                        </h1>
                        <p className="max-w-2xl text-base leading-7 text-slate-600">
                            {t("employee.workspaceDescription")}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <LanguageSwitcher />
                        <SignOutButton />
                    </div>
                </div>
                <CustomerSearchPanel />
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                        {t("employee.currentOperator")}
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {context.membership.fullName ??
                            context.membership.email}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                        {t("common.tenant")}: {context.tenant.slug} ·{" "}
                        {t("common.role")}:{" "}
                        {t(
                            `role.${context.role}` as
                                | "role.owner"
                                | "role.employee"
                        )}
                    </p>
                </div>
            </section>
        </main>
    );
}
