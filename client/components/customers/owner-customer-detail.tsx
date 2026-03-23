"use client";

import Link from "next/link";
import { useState } from "react";

import {
    type OwnerCustomerProfile,
    useOwnerCustomerProfile,
    useUpdateOwnerCustomer,
} from "@/lib/hooks/use-owner-customers";

export function OwnerCustomerDetail({ customerId }: { customerId: string }) {
    const profileQuery = useOwnerCustomerProfile(customerId, 20);
    const updateMutation = useUpdateOwnerCustomer(customerId);

    const profile = profileQuery.data?.pages[0] ?? null;
    const transactions =
        profileQuery.data?.pages.flatMap((page) => page.recentTransactions) ??
        [];

    if (profileQuery.isLoading) {
        return (
            <p className="text-sm text-slate-500">
                Loading customer profile...
            </p>
        );
    }

    if (profileQuery.error || !profile) {
        return (
            <p className="text-sm text-red-600">
                {profileQuery.error?.message ??
                    "Could not load customer profile"}
            </p>
        );
    }

    return (
        <OwnerCustomerDetailContent
            profile={profile}
            transactions={transactions}
            isUpdating={updateMutation.isPending}
            hasNextPage={profileQuery.hasNextPage}
            isFetchingNextPage={profileQuery.isFetchingNextPage}
            onFetchNextPage={() => void profileQuery.fetchNextPage()}
            onSave={async ({ tags, status, setError }) => {
                setError(null);

                try {
                    await updateMutation.mutateAsync({ tags, status });
                } catch (error) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "Could not update customer"
                    );
                }
            }}
        />
    );
}

function OwnerCustomerDetailContent({
    profile,
    transactions,
    isUpdating,
    hasNextPage,
    isFetchingNextPage,
    onFetchNextPage,
    onSave,
}: {
    profile: OwnerCustomerProfile;
    transactions: OwnerCustomerProfile["recentTransactions"];
    isUpdating: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onFetchNextPage: () => void;
    onSave: (params: {
        tags: string[];
        status: "active" | "inactive";
        setError: (error: string | null) => void;
    }) => Promise<void>;
}) {
    const [tagsInput, setTagsInput] = useState(profile.tags.join(", "));
    const [statusInput, setStatusInput] = useState<"active" | "inactive">(
        profile.status
    );
    const [saveError, setSaveError] = useState<string | null>(null);

    async function handleSave() {
        const tags = tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        await onSave({
            tags,
            status: statusInput,
            setError: setSaveError,
        });
    }

    return (
        <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                        {profile.name}
                    </h2>
                    <p className="text-sm text-slate-600">{profile.phone}</p>
                </div>
                <Link
                    href="/customers"
                    className="button rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                >
                    Back to Customers List
                </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                        Email
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                        {profile.email ?? "-"}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                        Points balance
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                        {profile.pointsBalance}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                        Created
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                        {new Date(profile.createdAt).toLocaleString()}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                        Last visit
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                        {profile.lastVisitAt
                            ? new Date(profile.lastVisitAt).toLocaleString()
                            : "-"}
                    </p>
                </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                    Customer segmentation
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                            Tags (comma separated)
                        </label>
                        <input
                            value={tagsInput}
                            onChange={(event) =>
                                setTagsInput(event.target.value)
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                            Status
                        </label>
                        <select
                            value={statusInput}
                            onChange={(event) =>
                                setStatusInput(
                                    event.target.value as "active" | "inactive"
                                )
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isUpdating}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                    {isUpdating ? "Saving..." : "Save customer settings"}
                </button>
                {saveError ? (
                    <p className="text-sm text-red-600">{saveError}</p>
                ) : null}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                    Transaction history
                </h3>
                {transactions.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        No transactions yet.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {transactions.map((transaction) => (
                            <li
                                key={transaction.id}
                                className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase text-slate-600">
                                        {transaction.type}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {new Date(
                                            transaction.createdAt
                                        ).toLocaleString()}
                                    </p>
                                </div>
                                <p className="mt-1 text-sm text-slate-800">
                                    {transaction.type === "credit" ? "+" : "-"}
                                    {transaction.amount} points
                                </p>
                                <p className="text-xs text-slate-600">
                                    Balance after: {transaction.balanceAfter}
                                </p>
                                <p className="text-xs text-slate-600">
                                    Performed by:{" "}
                                    {transaction.performedByName ?? "Unknown"}
                                </p>
                                {transaction.note ? (
                                    <p className="mt-1 text-xs text-slate-600">
                                        {transaction.note}
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}

                {hasNextPage ? (
                    <button
                        type="button"
                        onClick={onFetchNextPage}
                        disabled={isFetchingNextPage}
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                    >
                        {isFetchingNextPage ? "Loading..." : "Load more"}
                    </button>
                ) : null}
            </div>
        </section>
    );
}
