"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import {
    useIssueOwnerWalletPass,
    useOwnerCustomers,
    useSyncOwnerWalletPass,
} from "@/lib/hooks/use-owner-customers";

const PAGE_SIZE = 20;

export function OwnerWalletManagement() {
    const [searchInput, setSearchInput] = useState("");
    const [page, setPage] = useState(1);
    const [walletFilter, setWalletFilter] = useState<
        "all" | "issued" | "missing"
    >("all");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLocale();

    const customersQuery = useOwnerCustomers({
        search: searchInput.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortBy: "registration",
        sortOrder: "desc",
    });

    const issuePassMutation = useIssueOwnerWalletPass();
    const syncPassMutation = useSyncOwnerWalletPass();

    const filteredCustomers = useMemo(() => {
        const rows = customersQuery.data?.data ?? [];

        if (walletFilter === "all") {
            return rows;
        }

        return rows.filter((customer) =>
            walletFilter === "issued"
                ? Boolean(customer.walletPassId)
                : !customer.walletPassId
        );
    }, [customersQuery.data?.data, walletFilter]);

    async function handleIssuePass(customerId: string) {
        setMessage(null);
        setError(null);

        try {
            const result = await issuePassMutation.mutateAsync(customerId);
            setMessage(`${t("wallet.issueSuccess")} (${result.walletPassId}).`);
        } catch (mutationError) {
            setError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("wallet.issueError")
            );
        }
    }

    async function handleSyncPass(customerId: string) {
        setMessage(null);
        setError(null);

        try {
            await syncPassMutation.mutateAsync(customerId);
            setMessage(t("wallet.syncSuccess"));
        } catch (mutationError) {
            setError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("wallet.syncError")
            );
        }
    }

    return (
        <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("wallet.eyebrow")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {t("wallet.title")}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        {t("wallet.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/customers"
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                    >
                        {t("wallet.openCrm")}
                    </Link>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <input
                    value={searchInput}
                    onChange={(event) => {
                        setSearchInput(event.target.value);
                        setPage(1);
                    }}
                    placeholder={t("wallet.searchCustomer")}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
                <select
                    value={walletFilter}
                    onChange={(event) =>
                        setWalletFilter(
                            event.target.value as "all" | "issued" | "missing"
                        )
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                    <option value="all">{t("wallet.allCustomers")}</option>
                    <option value="issued">{t("wallet.passIssued")}</option>
                    <option value="missing">{t("wallet.missingPass")}</option>
                </select>
                <p className="self-center text-sm text-slate-500">
                    {customersQuery.data?.pagination.total ?? 0}{" "}
                    {t("wallet.totalCustomers")}
                </p>
            </div>

            {customersQuery.isLoading ? (
                <p className="text-sm text-slate-500">
                    {t("wallet.loadingCustomers")}
                </p>
            ) : customersQuery.error ? (
                <p className="text-sm text-red-600">
                    {customersQuery.error.message}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">
                                    {t("wallet.table.customer")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("wallet.table.phone")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("wallet.table.points")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("wallet.table.status")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("wallet.table.actions")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td
                                        className="px-4 py-5 text-sm text-slate-500"
                                        colSpan={5}
                                    >
                                        {t("wallet.noneForFilter")}
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id}>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {customer.name}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {customer.phone}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {customer.pointsBalance}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {customer.walletPassId
                                                ? t("wallet.issued")
                                                : t("wallet.missing")}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleIssuePass(
                                                            customer.id
                                                        )
                                                    }
                                                    disabled={
                                                        issuePassMutation.isPending
                                                    }
                                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                                                >
                                                    {customer.walletPassId
                                                        ? t("wallet.reissue")
                                                        : t("wallet.issuePass")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleSyncPass(
                                                            customer.id
                                                        )
                                                    }
                                                    disabled={
                                                        syncPassMutation.isPending ||
                                                        !customer.walletPassId
                                                    }
                                                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                                                >
                                                    {t("wallet.syncBalance")}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page === 1 || customersQuery.isLoading}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                >
                    {t("common.previous")}
                </button>
                <p className="text-xs text-slate-500">
                    {t("wallet.page")} {page}
                </p>
                <button
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={
                        customersQuery.isLoading ||
                        (customersQuery.data?.pagination.totalPages ?? 1) <=
                            page
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                >
                    {t("common.next")}
                </button>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? (
                <p className="text-sm text-emerald-700">{message}</p>
            ) : null}
        </section>
    );
}
