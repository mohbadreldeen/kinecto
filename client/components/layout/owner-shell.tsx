import { AppHeader } from "@/components/layout/app-header";
import { TenantStoreSync } from "@/components/providers/tenant-store-sync";

type OwnerContext = {
    tenant: {
        id: string;
        name: string;
        logoUrl: string | null;
        brandColors: Record<string, string> | null;
    };
    role: "owner" | "employee";
};

type Props = {
    context: OwnerContext;
    children: React.ReactNode;
};

export function OwnerShell({ context, children }: Props) {
    const brandColors = (context.tenant.brandColors ?? {}) as Record<
        string,
        string
    >;

    return (
        <>
            <TenantStoreSync
                tenantId={context.tenant.id}
                tenantName={context.tenant.name}
                role={context.role}
                brandColors={brandColors}
                logoUrl={context.tenant.logoUrl}
            />
            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_32%),linear-gradient(180deg,_#fffdf8_0%,_#fff_55%,_#f8fafc_100%)] text-slate-950">
                <AppHeader
                    tenantName={context.tenant.name}
                    logoUrl={context.tenant.logoUrl}
                />
                <div className="mx-auto w-full max-w-6xl px-6 py-8">
                    {children}
                </div>
            </div>
        </>
    );
}
