"use client";

import { useMemo, useState } from "react";

import {
    useDeleteOwnerEmployee,
    useOwnerEmployees,
    useUpdateOwnerEmployee,
} from "@/lib/hooks/use-owner-employees";
import { useLocale } from "@/lib/i18n/use-locale";

export function OwnerEmployeesManagement() {
    const [statusFilter, setStatusFilter] = useState<
        "all" | "active" | "inactive"
    >("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "email">("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [actionError, setActionError] = useState<string | null>(null);
    const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(
        null
    );

    const employeesQuery = useOwnerEmployees();
    const updateEmployee = useUpdateOwnerEmployee();
    const deleteEmployee = useDeleteOwnerEmployee();
    const { locale, t } = useLocale();

    const employees = employeesQuery.data ?? [];
    const filteredEmployees = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        const filtered = employees.filter((employee) => {
            if (statusFilter !== "all" && employee.status !== statusFilter) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const displayName = (employee.fullName ?? "").toLowerCase();
            const email = employee.email.toLowerCase();

            return (
                displayName.includes(normalizedSearch) ||
                email.includes(normalizedSearch)
            );
        });

        const sorted = [...filtered].sort((left, right) => {
            const leftName = (left.fullName ?? left.email).toLowerCase();
            const rightName = (right.fullName ?? right.email).toLowerCase();
            const leftEmail = left.email.toLowerCase();
            const rightEmail = right.email.toLowerCase();

            const comparison =
                sortBy === "name"
                    ? leftName.localeCompare(rightName)
                    : leftEmail.localeCompare(rightEmail);

            return sortDirection === "asc" ? comparison : -comparison;
        });

        return sorted;
    }, [employees, searchTerm, sortBy, sortDirection, statusFilter]);

    const activeCount = employees.filter(
        (employee) => employee.status === "active"
    ).length;
    const inactiveCount = employees.length - activeCount;

    async function handleToggleStatus(params: {
        employeeId: string;
        currentStatus: "active" | "inactive";
        fullName: string;
    }) {
        setActionError(null);
        setPendingEmployeeId(params.employeeId);

        const nextStatus =
            params.currentStatus === "active" ? "inactive" : "active";

        try {
            await updateEmployee.mutateAsync({
                employeeId: params.employeeId,
                payload: { status: nextStatus },
            });
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : `${t("employees.updateError")} ${params.fullName}`
            );
        } finally {
            setPendingEmployeeId(null);
        }
    }

    async function handleDelete(params: {
        employeeId: string;
        fullName: string;
    }) {
        const confirmed = window.confirm(
            `${t("employees.deleteConfirm")} ${params.fullName}? ${t("employees.deleteConfirmSuffix")}`
        );

        if (!confirmed) {
            return;
        }

        setActionError(null);
        setPendingEmployeeId(params.employeeId);

        try {
            await deleteEmployee.mutateAsync(params.employeeId);
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : `${t("employees.deleteError")} ${params.fullName}`
            );
        } finally {
            setPendingEmployeeId(null);
        }
    }

    return (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                        {t("employees.accessTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        {t("employees.accessSubtitle")}
                    </p>
                </div>
                <div className="flex gap-2 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                            {t("common.total")}
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                            {employees.length}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                            {t("common.active")}
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                            {activeCount}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                            {t("common.inactive")}
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                            {inactiveCount}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                <div>
                    <label
                        htmlFor="employee-search"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                        {t("employees.searchLabel")}
                    </label>
                    <input
                        id="employee-search"
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t("employees.searchPlaceholder")}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-(--brand-accent)"
                    />
                </div>
                <div>
                    <label
                        htmlFor="employee-sort-by"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                        {t("employees.sortBy")}
                    </label>
                    <select
                        id="employee-sort-by"
                        value={sortBy}
                        onChange={(event) =>
                            setSortBy(event.target.value as "name" | "email")
                        }
                        className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-(--brand-accent)"
                    >
                        <option value="name">{t("employees.sortName")}</option>
                        <option value="email">
                            {t("employees.sortEmail")}
                        </option>
                    </select>
                </div>
                <div>
                    <label
                        htmlFor="employee-sort-direction"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                        {t("employees.direction")}
                    </label>
                    <select
                        id="employee-sort-direction"
                        value={sortDirection}
                        onChange={(event) =>
                            setSortDirection(
                                event.target.value as "asc" | "desc"
                            )
                        }
                        className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-(--brand-accent)"
                    >
                        <option value="asc">
                            {t("employees.directionAsc")}
                        </option>
                        <option value="desc">
                            {t("employees.directionDesc")}
                        </option>
                    </select>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        statusFilter === "all"
                            ? "bg-(--brand-accent) text-white"
                            : "border border-slate-300 text-slate-700 hover:border-slate-500"
                    }`}
                >
                    {t("employees.filterAll")}
                </button>
                <button
                    type="button"
                    onClick={() => setStatusFilter("active")}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        statusFilter === "active"
                            ? "bg-(--brand-accent) text-white"
                            : "border border-slate-300 text-slate-700 hover:border-slate-500"
                    }`}
                >
                    {t("employees.filterActive")}
                </button>
                <button
                    type="button"
                    onClick={() => setStatusFilter("inactive")}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        statusFilter === "inactive"
                            ? "bg-(--brand-accent) text-white"
                            : "border border-slate-300 text-slate-700 hover:border-slate-500"
                    }`}
                >
                    {t("employees.filterInactive")}
                </button>
            </div>

            {actionError ? (
                <p className="mt-4 text-sm text-red-600">{actionError}</p>
            ) : null}

            <div className="mt-5 space-y-3">
                {employeesQuery.isLoading ? (
                    <p className="text-sm text-slate-500">
                        {t("employees.loading")}
                    </p>
                ) : employeesQuery.error ? (
                    <p className="text-sm text-red-600">
                        {employeesQuery.error.message}
                    </p>
                ) : filteredEmployees.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        {t("employees.none")}
                    </p>
                ) : (
                    filteredEmployees.map((employee) => {
                        const displayName = employee.fullName ?? employee.email;
                        const isPending = pendingEmployeeId === employee.id;

                        return (
                            <article
                                key={employee.id}
                                className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                            >
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-base font-semibold text-slate-950">
                                            {displayName}
                                        </h3>
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                employee.status === "active"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-slate-200 text-slate-700"
                                            }`}
                                        >
                                            {employee.status === "active"
                                                ? t("common.active")
                                                : t("common.inactive")}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {employee.email}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {t("employees.added")}{" "}
                                        {new Date(
                                            employee.createdAt
                                        ).toLocaleString(locale)}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleToggleStatus({
                                                employeeId: employee.id,
                                                currentStatus: employee.status,
                                                fullName: displayName,
                                            })
                                        }
                                        disabled={isPending}
                                        className="rounded-md bg-(--brand-accent) px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                    >
                                        {isPending
                                            ? t("employees.saving")
                                            : employee.status === "active"
                                              ? t(
                                                    "employees.disableTemporarily"
                                                )
                                              : t("employees.reEnable")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleDelete({
                                                employeeId: employee.id,
                                                fullName: displayName,
                                            })
                                        }
                                        disabled={isPending}
                                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-60"
                                    >
                                        {isPending
                                            ? t("employees.working")
                                            : t("employees.delete")}
                                    </button>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </section>
    );
}
