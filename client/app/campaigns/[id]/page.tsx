import { OwnerCampaignDetail } from "@/components/campaigns/owner-campaign-detail";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export default async function CampaignDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const context = await requireSessionContext("owner");
    const resolvedParams = await params;

    return (
        <OwnerShell context={context}>
            <OwnerCampaignDetail campaignId={resolvedParams.id} />
        </OwnerShell>
    );
}
