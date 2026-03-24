"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { OwnerCustomerCreateForm } from "@/components/customers/owner-customer-create-form";
import {
    useExportOwnerCustomersCsv,
    useOwnerCustomers,
} from "@/lib/hooks/use-owner-customers";
import {
    useCreateOwnerSegment,
    useDeleteOwnerSegment,
    useOwnerSegments,
} from "@/lib/hooks/use-owner-segments";
import { useLocale } from "@/lib/i18n/use-locale";

const DEFAULT_PAGE_SIZE = 20;

export function OwnerCustomersCrm() {
    const { t } = useLocale();
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
    const [tag, setTag] = useState("");
    const [minPoints, setMinPoints] = useState("");
    const [maxPoints, setMaxPoints] = useState("");
    const [sortBy, setSortBy] = useState<
        "registration" | "name" | "points" | "lastActivity"
    >("registration");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [segmentName, setSegmentName] = useState("");
    const [segmentDescription, setSegmentDescription] = useState("");
    const [segmentError, setSegmentError] = useState<string | null>(null);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
        []
    );
    const [exportError, setExportError] = useState<string | null>(null);

    useEffect(() => {
        const id = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 300);

        return () => clearTimeout(id);
    }, [searchInput]);

    const query = useMemo(
        () => ({
            search,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
            status: status === "all" ? undefined : status,
            tag: tag.trim() || undefined,
            minPoints: minPoints ? Number(minPoints) : undefined,
            maxPoints: maxPoints ? Number(maxPoints) : undefined,
            sortBy,
            sortOrder,
        }),
        [maxPoints, minPoints, page, search, sortBy, sortOrder, status, tag]
    );

    const customersQuery = useOwnerCustomers(query);
    const exportCsvMutation = useExportOwnerCustomersCsv();
    const segmentsQuery = useOwnerSegments();
    const createSegment = useCreateOwnerSegment();
    const deleteSegment = useDeleteOwnerSegment();

    async function handleCreateSegment() {
        setSegmentError(null);

        const name = segmentName.trim();
        if (!name) {
            setSegmentError("Segment name is required");
            return;
        }

        try {
            await createSegment.mutateAsync({
                name,
                description: segmentDescription.trim() || undefined,
                filterCriteria: {
                    search: search || undefined,
                    status: status === "all" ? undefined : status,
                    tag: tag.trim() || undefined,
                    minPoints: minPoints ? Number(minPoints) : undefined,
                    maxPoints: maxPoints ? Number(maxPoints) : undefined,
                    sortBy,
                    sortOrder,
                },
            });

            setSegmentName("");
            setSegmentDescription("");
        } catch (error) {
            setSegmentError(
                error instanceof Error
                    ? error.message
                    : "Could not save segment"
            );
        }
    }

    function applySegment(segment: {
        filterCriteria: {
            search?: string;
            status?: "active" | "inactive";
            tag?: string;
            minPoints?: number;
            maxPoints?: number;
            sortBy?: "registration" | "name" | "points" | "lastActivity";
            sortOrder?: "asc" | "desc";
        };
    }) {
        setSearchInput(segment.filterCriteria.search ?? "");
        setSearch(segment.filterCriteria.search ?? "");
        setStatus(segment.filterCriteria.status ?? "all");
        setTag(segment.filterCriteria.tag ?? "");
        setMinPoints(
            segment.filterCriteria.minPoints !== undefined
                ? String(segment.filterCriteria.minPoints)
                : ""
        );
        setMaxPoints(
            segment.filterCriteria.maxPoints !== undefined
                ? String(segment.filterCriteria.maxPoints)
                : ""
        );
        setSortBy(segment.filterCriteria.sortBy ?? "registration");
        setSortOrder(segment.filterCriteria.sortOrder ?? "desc");
        setPage(1);
    }

    async function handleDeleteSegment(segmentId: string) {
        setSegmentError(null);

        try {
            await deleteSegment.mutateAsync(segmentId);
        } catch (error) {
            setSegmentError(
                error instanceof Error
                    ? error.message
                    : "Could not delete segment"
            );
        }
    }

    const currentPageCustomerIds = (customersQuery.data?.data ?? []).map(
        (customer) => customer.id
    );
    const allCurrentPageSelected =
        currentPageCustomerIds.length > 0 &&
        currentPageCustomerIds.every((id) => selectedCustomerIds.includes(id));
    const newCampaignHref =
        selectedCustomerIds.length > 0
            ? `/campaigns/new?${selectedCustomerIds
                  .map(
                      (id) => `selectedIds=${encodeURIComponent(id)}`
                  )
                  .join("&")}`
            : "/campaigns/new";

    function toggleSelectCustomer(customerId: string) {
        setSelectedCustomerIds((current) =>
            current.includes(customerId)
                ? current.filter((id) => id !== customerId)
                : [...current, customerId]
        );
    }

    function toggleSelectCurrentPage() {
        setSelectedCustomerIds((current) => {
            if (allCurrentPageSelected) {
                return current.filter(
                    (id) => !currentPageCustomerIds.includes(id)
                );
            }

            const next = new Set(current);
            currentPageCustomerIds.forEach((id) => next.add(id));
            return [...next];
        });
    }

    async function handleExportCsv(params: { selectedOnly: boolean }) {
        setExportError(null);

        const selectedIds = params.selectedOnly ? selectedCustomerIds : [];
        if (params.selectedOnly && selectedIds.length === 0) {
            setExportError(
                "Select at least one customer to export selected rows"
            );
            return;
        }

        try {
            const result = await exportCsvMutation.mutateAsync({
                search,
                status: status === "all" ? undefined : status,
                tag: tag.trim() || undefined,
                minPoints: minPoints ? Number(minPoints) : undefined,
                maxPoints: maxPoints ? Number(maxPoints) : undefined,
                sortBy,
                sortOrder,
                selectedIds,
            });

            const url = URL.createObjectURL(result.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = result.filename;
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            setExportError(
                error instanceof Error ? error.message : "Could not export CSV"
            );
        }
    }

    return (
        <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                        {t("customers.crmTitle")}
                    </h2>
                    <p className="text-sm text-slate-600">
                        Search, filter, and open detailed customer profiles.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-500">
                        {customersQuery.data?.pagination.total ?? 0} total
                        customers
                    </p>
                    <Link
                        href={newCampaignHref}
                        className="button rounded-md border border-slate-300 px-3 py-2 text-md font-semibold text-slate-700 transition hover:border-slate-500"
                    >
                        New campaign
                    </Link>
                </div>
            </div>

            <OwnerCustomerCreateForm />

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search name or phone"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />

                <select
                    value={status}
                    onChange={(event) => {
                        setStatus(event.target.value as typeof status);
                        setPage(1);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>

                <input
                    value={tag}
                    onChange={(event) => {
                        setTag(event.target.value);
                        setPage(1);
                    }}
                    placeholder="Tag filter"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />

                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="number"
                        min={0}
                        value={minPoints}
                        onChange={(event) => {
                            setMinPoints(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Min pts"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    />
                    <input
                        type="number"
                        min={0}
                        value={maxPoints}
                        onChange={(event) => {
                            setMaxPoints(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Max pts"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    />
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <select
                    value={sortBy}
                    onChange={(event) => {
                        setSortBy(event.target.value as typeof sortBy);
                        setPage(1);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                    <option value="registration">Sort by registration</option>
                    <option value="name">Sort by name</option>
                    <option value="points">Sort by points</option>
                    <option value="lastActivity">Sort by last activity</option>
                </select>
                <select
                    value={sortOrder}
                    onChange={(event) => {
                        setSortOrder(event.target.value as typeof sortOrder);
                        setPage(1);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                </select>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                        Saved segments
                    </h3>
                    <p className="text-xs text-slate-500">
                        {segmentsQuery.data?.length ?? 0} saved
                    </p>
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
                    <input
                        value={segmentName}
                        onChange={(event) => setSegmentName(event.target.value)}
                        placeholder="Segment name"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    />
                    <input
                        value={segmentDescription}
                        onChange={(event) =>
                            setSegmentDescription(event.target.value)
                        }
                        placeholder="Description (optional)"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    />
                    <button
                        type="button"
                        onClick={() => void handleCreateSegment()}
                        disabled={createSegment.isPending}
                        className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                        {createSegment.isPending
                            ? "Saving..."
                            : "Save current filters"}
                    </button>
                </div>

                {segmentError ? (
                    <p className="text-sm text-red-600">{segmentError}</p>
                ) : null}

                {segmentsQuery.isLoading ? (
                    <p className="text-sm text-slate-500">
                        Loading segments...
                    </p>
                ) : segmentsQuery.error ? (
                    <p className="text-sm text-red-600">
                        {segmentsQuery.error.message}
                    </p>
                ) : segmentsQuery.data && segmentsQuery.data.length > 0 ? (
                    <ul className="space-y-2">
                        {segmentsQuery.data.map((segment) => (
                            <li
                                key={segment.id}
                                className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 md:flex-row md:items-center md:justify-between"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                        {segment.name}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        {segment.description ||
                                            "No description"}{" "}
                                        · {segment.customerCount} customers
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => applySegment(segment)}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                                    >
                                        Apply
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleDeleteSegment(segment.id)
                                        }
                                        disabled={deleteSegment.isPending}
                                        className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-400 disabled:opacity-50"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-slate-500">
                        No segments saved yet.
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                    {selectedCustomerIds.length} selected
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            void handleExportCsv({ selectedOnly: true })
                        }
                        disabled={exportCsvMutation.isPending}
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                    >
                        Export selected CSV
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            void handleExportCsv({ selectedOnly: false })
                        }
                        disabled={exportCsvMutation.isPending}
                        className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                        Export filtered CSV
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedCustomerIds([])}
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                    >
                        Clear selection
                    </button>
                    <Link
                        href={newCampaignHref}
                        aria-disabled={selectedCustomerIds.length === 0}
                        className={`button rounded-md px-3 py-2 text-md font-semibold transition ${
                            selectedCustomerIds.length > 0
                                ? "bg-(--brand-accent) text-white hover:opacity-90"
                                : "pointer-events-none bg-slate-200 text-slate-500"
                        }`}
                    >
                        Message selected
                    </Link>
                </div>
            </div>

            {exportError ? (
                <p className="text-sm text-red-600">{exportError}</p>
            ) : null}

            {customersQuery.isLoading ? (
                <p className="text-sm text-slate-500">Loading customers...</p>
            ) : customersQuery.error ? (
                <p className="text-sm text-red-600">
                    {customersQuery.error.message}
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={allCurrentPageSelected}
                                            onChange={toggleSelectCurrentPage}
                                            aria-label="Select current page"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        Name
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        Phone
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        Points
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        Last visit
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        Tags
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {(customersQuery.data?.data ?? []).map(
                                    (customer) => (
                                        <tr key={customer.id}>
                                            <td className="px-4 py-3 text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCustomerIds.includes(
                                                        customer.id
                                                    )}
                                                    onChange={() =>
                                                        toggleSelectCustomer(
                                                            customer.id
                                                        )
                                                    }
                                                    aria-label={`Select ${customer.name}`}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                {customer.name}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">
                                                {customer.phone}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">
                                                {customer.pointsBalance}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 capitalize">
                                                {customer.status}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">
                                                {customer.lastVisitAt
                                                    ? new Date(
                                                          customer.lastVisitAt
                                                      ).toLocaleDateString()
                                                    : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">
                                                {customer.tags.length > 0
                                                    ? customer.tags.join(", ")
                                                    : "-"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/customers/${customer.id}`}
                                                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                                                >
                                                    View profile
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Page {customersQuery.data?.pagination.page ?? 1} of{" "}
                            {customersQuery.data?.pagination.totalPages ?? 1}
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setPage((value) => Math.max(1, value - 1))
                                }
                                disabled={
                                    page <= 1 || customersQuery.isFetching
                                }
                                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setPage((value) => {
                                        const totalPages =
                                            customersQuery.data?.pagination
                                                .totalPages ?? value;
                                        return Math.min(totalPages, value + 1);
                                    })
                                }
                                disabled={
                                    customersQuery.isFetching ||
                                    page >=
                                        (customersQuery.data?.pagination
                                            .totalPages ?? 1)
                                }
                                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
