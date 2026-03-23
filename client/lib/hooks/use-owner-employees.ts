"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type OwnerEmployee = {
    id: string;
    email: string;
    fullName: string | null;
    status: "active" | "inactive";
    createdAt: string;
    updatedAt: string;
};

type UpdateOwnerEmployeePayload = {
    status: "active" | "inactive";
};

async function fetchOwnerEmployees() {
    const response = await fetch("/api/employees", {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: OwnerEmployee[];
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load employees");
    }

    return payload.data;
}

async function updateOwnerEmployee(
    employeeId: string,
    payload: UpdateOwnerEmployeePayload
) {
    const response = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const payloadJson = (await response.json().catch(() => null)) as {
        data?: OwnerEmployee;
        error?: string;
    } | null;

    if (!response.ok || !payloadJson?.data) {
        throw new Error(payloadJson?.error ?? "Could not update employee");
    }

    return payloadJson.data;
}

async function deleteOwnerEmployee(employeeId: string) {
    const response = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
        credentials: "include",
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;

        throw new Error(payload?.error ?? "Could not delete employee");
    }
}

export function useOwnerEmployees() {
    return useQuery({
        queryKey: ["owner-employees"],
        queryFn: fetchOwnerEmployees,
        staleTime: 10_000,
    });
}

export function useUpdateOwnerEmployee() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            employeeId,
            payload,
        }: {
            employeeId: string;
            payload: UpdateOwnerEmployeePayload;
        }) => updateOwnerEmployee(employeeId, payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-employees"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["dashboard-summary"],
            });
        },
    });
}

export function useDeleteOwnerEmployee() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteOwnerEmployee,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["owner-employees"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["dashboard-summary"],
            });
        },
    });
}
