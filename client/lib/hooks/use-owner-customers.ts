"use client";

import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

export type OwnerCustomerListItem = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    pointsBalance: number;
    tags: string[];
    status: "active" | "inactive";
    walletPassId: string | null;
    lastVisitAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type OwnerCustomerListQuery = {
    search?: string;
    page?: number;
    pageSize?: number;
    status?: "active" | "inactive";
    tag?: string;
    minPoints?: number;
    maxPoints?: number;
    registeredFrom?: string;
    registeredTo?: string;
    lastVisitFrom?: string;
    lastVisitTo?: string;
    sortBy?: "registration" | "name" | "points" | "lastActivity";
    sortOrder?: "asc" | "desc";
};

export type OwnerCustomerListResponse = {
    data: OwnerCustomerListItem[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
};

export type OwnerCustomerProfile = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    pointsBalance: number;
    tags: string[];
    notes: string | null;
    qrCodeUrl: string | null;
    status: "active" | "inactive";
    lastVisitAt: string | null;
    createdAt: string;
    updatedAt: string;
    recentTransactions: Array<{
        id: string;
        type: "credit" | "debit";
        amount: number;
        balanceAfter: number;
        note: string | null;
        performedByUserId: string | null;
        performedByName: string | null;
        createdAt: string;
    }>;
    transactionPagination: {
        pageSize: number;
        returned: number;
        hasMore: boolean;
        nextCursor: {
            createdAt: string;
            id: string;
        } | null;
        appliedFilters: {
            txFrom: string | null;
            txTo: string | null;
        };
    };
};

export type OwnerCustomerUpdatePayload = {
    name?: string;
    phone?: string;
    email?: string | null;
    tags?: string[];
    notes?: string | null;
    status?: "active" | "inactive";
};

export type OwnerCustomerCreatePayload = {
    name: string;
    phone: string;
    email?: string;
    tags?: string[];
    notes?: string;
};

export type OwnerCustomerExportQuery = OwnerCustomerListQuery & {
    selectedIds?: string[];
};

type TransactionCursor = {
    createdAt: string;
    id: string;
};

function toUrlSearchParams(query: OwnerCustomerListQuery) {
    const params = new URLSearchParams();

    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.page) params.set("page", String(query.page));
    if (query.pageSize) params.set("pageSize", String(query.pageSize));
    if (query.status) params.set("status", query.status);
    if (query.tag?.trim()) params.set("tag", query.tag.trim());
    if (query.minPoints !== undefined)
        params.set("minPoints", String(query.minPoints));
    if (query.maxPoints !== undefined)
        params.set("maxPoints", String(query.maxPoints));
    if (query.registeredFrom)
        params.set("registeredFrom", query.registeredFrom);
    if (query.registeredTo) params.set("registeredTo", query.registeredTo);
    if (query.lastVisitFrom) params.set("lastVisitFrom", query.lastVisitFrom);
    if (query.lastVisitTo) params.set("lastVisitTo", query.lastVisitTo);
    if (query.sortBy) params.set("sortBy", query.sortBy);
    if (query.sortOrder) params.set("sortOrder", query.sortOrder);

    return params;
}

async function fetchOwnerCustomers(query: OwnerCustomerListQuery) {
    const params = toUrlSearchParams(query);
    const response = await fetch(`/api/customers?${params.toString()}`, {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as
        | OwnerCustomerListResponse
        | { error?: string }
        | null;

    if (!response.ok || !payload || !("data" in payload)) {
        throw new Error(
            (payload as { error?: string } | null)?.error ??
                "Could not load customers"
        );
    }

    return payload;
}

async function fetchOwnerCustomerProfile(
    customerId: string,
    txPageSize: number,
    cursor?: TransactionCursor
) {
    const params = new URLSearchParams({
        txPageSize: String(txPageSize),
    });

    if (cursor) {
        params.set("txCursorCreatedAt", cursor.createdAt);
        params.set("txCursorId", cursor.id);
    }

    const response = await fetch(
        `/api/customers/${customerId}?${params.toString()}`,
        {
            method: "GET",
            credentials: "include",
        }
    );

    const payload = (await response.json().catch(() => null)) as {
        data?: OwnerCustomerProfile;
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load customer profile");
    }

    return payload.data;
}

async function patchOwnerCustomer(
    customerId: string,
    payload: OwnerCustomerUpdatePayload
) {
    const response = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: OwnerCustomerListItem;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not update customer");
    }

    return json.data;
}

async function createOwnerCustomer(payload: OwnerCustomerCreatePayload) {
    const response = await fetch("/api/customers", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: OwnerCustomerListItem & {
            qrCodeUrl?: string | null;
            walletPassId?: string | null;
            walletPassUrl?: string | null;
        };
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not create customer");
    }

    return json.data;
}

async function exportOwnerCustomersCsv(query: OwnerCustomerExportQuery) {
    const params = toUrlSearchParams(query);
    (query.selectedIds ?? []).forEach((id) => params.append("selectedIds", id));

    const response = await fetch(`/api/customers/export?${params.toString()}`, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not export customers");
    }

    const contentDisposition =
        response.headers.get("content-disposition") ?? "";
    const filenameMatch = contentDisposition.match(/filename=\"([^\"]+)\"/i);
    const filename = filenameMatch?.[1] ?? "customers-export.csv";

    return {
        blob: await response.blob(),
        filename,
    };
}

async function issueOwnerWalletPass(customerId: string) {
    const response = await fetch("/api/wallet/create", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerId }),
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: {
            customerId: string;
            walletPassId: string;
            walletPassUrl: string | null;
        };
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not issue wallet pass");
    }

    return payload.data;
}

async function syncOwnerWalletPass(customerId: string) {
    const response = await fetch("/api/wallet/update", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerId }),
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: {
            customerId: string;
            updated: boolean;
        };
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not sync wallet pass");
    }

    return payload.data;
}

export function useOwnerCustomers(query: OwnerCustomerListQuery) {
    return useQuery({
        queryKey: ["owner-customers", query],
        queryFn: () => fetchOwnerCustomers(query),
        staleTime: 10_000,
    });
}

export function useOwnerCustomerProfile(customerId: string, txPageSize = 20) {
    return useInfiniteQuery({
        queryKey: ["owner-customer-profile", customerId, txPageSize],
        queryFn: ({ pageParam }) =>
            fetchOwnerCustomerProfile(
                customerId,
                txPageSize,
                pageParam as TransactionCursor | undefined
            ),
        enabled: Boolean(customerId),
        initialPageParam: undefined as TransactionCursor | undefined,
        getNextPageParam: (lastPage) =>
            lastPage.transactionPagination.nextCursor ?? undefined,
        staleTime: 10_000,
    });
}

export function useUpdateOwnerCustomer(customerId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: OwnerCustomerUpdatePayload) =>
            patchOwnerCustomer(customerId, payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-customers"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["owner-customer-profile", customerId],
            });
        },
    });
}

export function useCreateOwnerCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createOwnerCustomer,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-customers"],
            });
        },
    });
}

export function useExportOwnerCustomersCsv() {
    return useMutation({
        mutationFn: exportOwnerCustomersCsv,
    });
}

export function useIssueOwnerWalletPass() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: issueOwnerWalletPass,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-customers"],
            });
        },
    });
}

export function useSyncOwnerWalletPass() {
    return useMutation({
        mutationFn: syncOwnerWalletPass,
    });
}
