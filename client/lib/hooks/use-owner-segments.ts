"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type OwnerSegmentFilterCriteria = {
    search?: string;
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

export type OwnerSegment = {
    id: string;
    name: string;
    description: string | null;
    filterCriteria: OwnerSegmentFilterCriteria;
    customerCount: number;
    createdAt: string;
    updatedAt: string;
};

export type OwnerCreateSegmentPayload = {
    name: string;
    description?: string;
    filterCriteria: OwnerSegmentFilterCriteria;
};

export type OwnerUpdateSegmentPayload = {
    name?: string;
    description?: string | null;
    filterCriteria?: OwnerSegmentFilterCriteria;
};

async function fetchOwnerSegments() {
    const response = await fetch("/api/segments", {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: OwnerSegment[];
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load segments");
    }

    return payload.data;
}

async function createOwnerSegment(payload: OwnerCreateSegmentPayload) {
    const response = await fetch("/api/segments", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: OwnerSegment;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not create segment");
    }

    return json.data;
}

async function patchOwnerSegment(
    segmentId: string,
    payload: OwnerUpdateSegmentPayload
) {
    const response = await fetch(`/api/segments/${segmentId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: OwnerSegment;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not update segment");
    }

    return json.data;
}

async function deleteOwnerSegment(segmentId: string) {
    const response = await fetch(`/api/segments/${segmentId}`, {
        method: "DELETE",
        credentials: "include",
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not delete segment");
    }
}

export function useOwnerSegments() {
    return useQuery({
        queryKey: ["owner-segments"],
        queryFn: fetchOwnerSegments,
        staleTime: 10_000,
    });
}

export function useCreateOwnerSegment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createOwnerSegment,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-segments"],
            });
        },
    });
}

export function useUpdateOwnerSegment(segmentId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: OwnerUpdateSegmentPayload) =>
            patchOwnerSegment(segmentId, payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-segments"],
            });
        },
    });
}

export function useDeleteOwnerSegment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteOwnerSegment,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-segments"],
            });
        },
    });
}
