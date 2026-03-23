"use client";

import { useQuery } from "@tanstack/react-query";

export type DashboardSummary = {
    tenant: {
        id: string;
        role: "owner" | "employee";
        email: string;
    };
    metrics: {
        totalCustomers: number;
        activeCustomers: number;
        activeEmployees: number;
    };
    recentCustomers: Array<{
        id: string;
        name: string;
        phone: string;
        pointsBalance: number;
        createdAt: string;
    }>;
    recentTransactions: Array<{
        id: string;
        customerId: string;
        customerName: string;
        type: "credit" | "debit";
        amount: number;
        balanceAfter: number;
        note: string | null;
        createdAt: string;
    }>;
};

async function fetchDashboardSummary() {
    const response = await fetch("/api/dashboard/summary", {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: DashboardSummary;
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load dashboard summary");
    }

    return payload.data;
}

export function useDashboardSummary() {
    return useQuery({
        queryKey: ["dashboard-summary"],
        queryFn: fetchDashboardSummary,
        staleTime: 30_000,
    });
}
