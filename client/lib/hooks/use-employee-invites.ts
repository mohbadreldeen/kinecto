"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type EmployeeInvite = {
    id: string;
    email: string;
    fullName: string | null;
    expiresAt: string;
    acceptedAt: string | null;
    createdAt: string;
    isExpired: boolean;
};

export type InviteEmployeePayload = {
    email: string;
    fullName?: string;
};

async function fetchInvites() {
    const response = await fetch("/api/employees/invites", {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: EmployeeInvite[];
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load invites");
    }

    return payload.data;
}

async function createInvite(payload: InviteEmployeePayload) {
    const response = await fetch("/api/employees/invites", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: EmployeeInvite;
        inviteUrl?: string;
        error?: string;
    } | null;

    if (!response.ok || !json?.data || !json.inviteUrl) {
        throw new Error(json?.error ?? "Could not create invite");
    }

    return { data: json.data, inviteUrl: json.inviteUrl };
}

async function resendInvite(id: string) {
    const response = await fetch(`/api/employees/invites/${id}`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const json = (await response.json().catch(() => null)) as {
        data?: EmployeeInvite;
        inviteUrl?: string;
        error?: string;
    } | null;

    if (!response.ok || !json?.data || !json.inviteUrl) {
        throw new Error(json?.error ?? "Could not resend invite");
    }

    return { data: json.data, inviteUrl: json.inviteUrl };
}

async function revokeInvite(id: string) {
    const response = await fetch(`/api/employees/invites/${id}`, {
        method: "DELETE",
        credentials: "include",
    });

    if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(json?.error ?? "Could not revoke invite");
    }
}

export function useEmployeeInvites() {
    return useQuery({
        queryKey: ["employee-invites"],
        queryFn: fetchInvites,
        staleTime: 10_000,
    });
}

export function useCreateEmployeeInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createInvite,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["employee-invites"],
            });
        },
    });
}

export function useResendEmployeeInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resendInvite,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["employee-invites"],
            });
        },
    });
}

export function useRevokeEmployeeInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: revokeInvite,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["employee-invites"],
            });
        },
    });
}
