import { BrandingForm } from "@/components/settings/branding-form";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export const metadata = { title: "Appearance" };

export default async function AppearancePage() {
    const context = await requireSessionContext("owner");
    const brandColors = (context.tenant.brandColors ?? {}) as {
        primary?: string;
        accent?: string;
    };

    return (
        <OwnerShell context={context}>
            <BrandingForm
                initialLogoUrl={context.tenant.logoUrl}
                initialBrandColors={{
                    primary: brandColors.primary ?? "#0f172a",
                    accent: brandColors.accent ?? "#f59e0b",
                }}
            />
        </OwnerShell>
    );
}
