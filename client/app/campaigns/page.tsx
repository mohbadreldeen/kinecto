import { OwnerCampaignsHistory } from "@/components/campaigns/owner-campaigns-history";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
    const context = await requireSessionContext("owner");

    return (
        <OwnerShell context={context}>
            <OwnerCampaignsHistory />
        </OwnerShell>
    );
}
