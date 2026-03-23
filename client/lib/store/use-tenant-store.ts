"use client";

import { create } from "zustand";

type TenantState = {
    tenantId: string | null;
    tenantName: string | null;
    role: "owner" | "employee" | null;
    brandColors: Record<string, string>;
    logoUrl: string | null;
    setTenantContext: (payload: {
        tenantId: string | null;
        tenantName?: string | null;
        role?: "owner" | "employee" | null;
        brandColors?: Record<string, string>;
        logoUrl?: string | null;
    }) => void;
    clear: () => void;
};

export const useTenantStore = create<TenantState>((set) => ({
    tenantId: null,
    tenantName: null,
    role: null,
    brandColors: {},
    logoUrl: null,
    setTenantContext: ({
        tenantId,
        tenantName = null,
        role = null,
        brandColors = {},
        logoUrl = null,
    }) => set({ tenantId, tenantName, role, brandColors, logoUrl }),
    clear: () =>
        set({
            tenantId: null,
            tenantName: null,
            role: null,
            brandColors: {},
            logoUrl: null,
        }),
}));
