"use client";

import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

export type EmployeeCustomerListItem = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    pointsBalance: number;
    qrCodeUrl?: string | null;
    status: "active" | "inactive";
    createdAt: string;
    updatedAt: string;
};

export type EmployeeCustomerProfile = EmployeeCustomerListItem & {
    tags: string[];
    notes: string | null;
    qrCodeUrl: string | null;
    lastVisitAt: string | null;
    recentTransactions: Array<{
        id: string;
        type: "credit" | "debit";
        amount: number;
        balanceAfter: number;
        note: string | null;
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

export type CustomerTransactionQueryOptions = {
    txPageSize?: number;
    txFrom?: string;
    txTo?: string;
};

type CustomerTransactionCursor = {
    createdAt: string;
    id: string;
};

export type AdjustCustomerPointsPayload = {
    type: "credit" | "debit";
    amount: number;
    note?: string;
};

export type QrLookupResult = {
    id: string;
    name: string;
    phone: string;
    qrCodeUrl: string | null;
};

export type CreateEmployeeCustomerPayload = {
    name: string;
    phone: string;
    email?: string;
};

async function fetchCustomerSearch(search: string) {
    const params = new URLSearchParams({
        page: "1",
        pageSize: "20",
    });

    if (search.trim().length > 0) {
        params.set("search", search.trim());
    }

    const response = await fetch(`/api/customers?${params.toString()}`, {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: EmployeeCustomerListItem[];
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load customers");
    }

    return payload.data;
}

async function fetchCustomerProfile(
    customerId: string,
    options: CustomerTransactionQueryOptions = {},
    cursor?: CustomerTransactionCursor
) {
    const params = new URLSearchParams();

    if (options.txPageSize) {
        params.set("txPageSize", String(options.txPageSize));
    }

    if (options.txFrom) {
        params.set("txFrom", options.txFrom);
    }

    if (options.txTo) {
        params.set("txTo", options.txTo);
    }

    if (cursor) {
        params.set("txCursorCreatedAt", cursor.createdAt);
        params.set("txCursorId", cursor.id);
    }

    const queryString = params.toString();
    const profileUrl = queryString
        ? `/api/customers/${customerId}?${queryString}`
        : `/api/customers/${customerId}`;

    const response = await fetch(profileUrl, {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: EmployeeCustomerProfile;
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load customer profile");
    }

    return payload.data;
}

async function adjustCustomerPoints(
    customerId: string,
    payload: AdjustCustomerPointsPayload
) {
    const response = await fetch(`/api/customers/${customerId}/points`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: {
            customerId: string;
            type: "credit" | "debit";
            amount: number;
            balanceAfter: number;
            transactionId: string;
        };
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not update points");
    }

    return json.data;
}

async function lookupCustomerByQr(qrCode: string) {
    const response = await fetch("/api/customers/by-qr", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrCode }),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: QrLookupResult;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not find customer by QR");
    }

    return json.data;
}

async function createEmployeeCustomer(payload: CreateEmployeeCustomerPayload) {
    const response = await fetch("/api/customers", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: EmployeeCustomerListItem;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not create customer");
    }

    return json.data;
}

export function useEmployeeCustomerSearch(search: string) {
    return useQuery({
        queryKey: ["employee-customer-search", search],
        queryFn: () => fetchCustomerSearch(search),
        staleTime: 10_000,
    });
}

export function useEmployeeCustomerProfile(customerId: string | null) {
    return useQuery({
        queryKey: ["employee-customer-profile", customerId],
        queryFn: () => fetchCustomerProfile(customerId as string),
        enabled: Boolean(customerId),
        staleTime: 10_000,
    });
}

export function useEmployeeCustomerProfileWithTransactions(
    customerId: string | null,
    options: CustomerTransactionQueryOptions
) {
    return useInfiniteQuery({
        queryKey: ["employee-customer-profile", customerId, options],
        queryFn: ({ pageParam }) =>
            fetchCustomerProfile(
                customerId as string,
                options,
                pageParam as CustomerTransactionCursor | undefined
            ),
        initialPageParam: undefined as CustomerTransactionCursor | undefined,
        getNextPageParam: (lastPage) =>
            lastPage.transactionPagination.nextCursor ?? undefined,
        enabled: Boolean(customerId),
        staleTime: 10_000,
    });
}

export function useAdjustCustomerPoints(customerId: string | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: AdjustCustomerPointsPayload) => {
            if (!customerId) {
                throw new Error("Select a customer first");
            }

            return adjustCustomerPoints(customerId, payload);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["employee-customer-profile", customerId],
            });
            void queryClient.invalidateQueries({
                queryKey: ["employee-customer-search"],
            });
        },
    });
}

export function useLookupCustomerByQr() {
    return useMutation({
        mutationFn: lookupCustomerByQr,
    });
}

export function useCreateEmployeeCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createEmployeeCustomer,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["employee-customer-search"],
            });
        },
    });
}
