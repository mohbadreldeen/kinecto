"use client";

import { useLocale } from "@/lib/i18n/use-locale";
import { useDashboardSummary } from "@/lib/hooks/use-dashboard-summary";

export function DashboardSummary() {
    const { data, isLoading, error } = useDashboardSummary();
    const { t } = useLocale();

    if (isLoading) {
        return (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">
                    {t("dashboard.loadingMetrics")}
                </p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-6 shadow-sm">
                <p className="text-sm text-red-700">
                    {t("dashboard.metricsError")}
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid gap-5 md:grid-cols-3">
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                        {t("dashboard.totalCustomers")}
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {data.metrics.totalCustomers}
                    </p>
                </article>
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                        {t("dashboard.activeCustomers")}
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {data.metrics.activeCustomers}
                    </p>
                </article>
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                        {t("dashboard.activeEmployees")}
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                        {data.metrics.activeEmployees}
                    </p>
                </article>
            </div>
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">
                    {t("dashboard.recentCustomers")}
                </h2>
                <div className="mt-4 space-y-3">
                    {data.recentCustomers.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            {t("dashboard.noCustomers")}
                        </p>
                    ) : (
                        data.recentCustomers.map((customer) => (
                            <div
                                key={customer.id}
                                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                            >
                                <div>
                                    <p className="font-medium text-slate-900">
                                        {customer.name}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {customer.phone}
                                    </p>
                                </div>
                                <p className="text-sm font-semibold text-slate-700">
                                    {customer.pointsBalance}{" "}
                                    {t("dashboard.pointsSuffix")}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </article>
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">
                    {t("dashboard.recentTransactions")}
                </h2>
                <div className="mt-4 space-y-3">
                    {data.recentTransactions.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            {t("dashboard.noTransactions")}
                        </p>
                    ) : (
                        data.recentTransactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                className="rounded-xl border border-slate-100 px-4 py-3"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {transaction.customerName}
                                    </p>
                                    <p className="text-xs uppercase text-slate-500">
                                        {transaction.type === "credit"
                                            ? t("transaction.credit")
                                            : t("transaction.debit")}
                                    </p>
                                </div>
                                <p className="mt-1 text-sm text-slate-700">
                                    {transaction.type === "credit" ? "+" : "-"}
                                    {transaction.amount}{" "}
                                    {t("dashboard.pointsSuffix")} •{" "}
                                    {t("dashboard.balanceLabel")}{" "}
                                    {transaction.balanceAfter}
                                </p>
                                {transaction.note ? (
                                    <p className="mt-1 text-xs text-slate-500">
                                        {transaction.note}
                                    </p>
                                ) : null}
                            </div>
                        ))
                    )}
                </div>
            </article>
        </>
    );
}
