"use client";

import { useEffect } from "react";

import { useTenantStore } from "@/lib/store/use-tenant-store";

type Props = {
    tenantId: string;
    tenantName: string;
    role: "owner" | "employee";
    brandColors?: Record<string, string>;
    logoUrl?: string | null;
};

export function TenantStoreSync({
    tenantId,
    tenantName,
    role,
    brandColors = {},
    logoUrl = null,
}: Props) {
    const setTenantContext = useTenantStore((state) => state.setTenantContext);

    useEffect(() => {
        setTenantContext({ tenantId, tenantName, role, brandColors, logoUrl });

        // Inject brand colors as CSS custom properties on the document root
        const root = document.documentElement;
        if (brandColors?.primary) {
            root.style.setProperty("--brand-primary", brandColors.primary);
        }
        if (brandColors?.accent) {
            root.style.setProperty("--brand-accent", brandColors.accent);
        }
    }, [role, setTenantContext, tenantId, tenantName, brandColors, logoUrl]);

    return null;
}
