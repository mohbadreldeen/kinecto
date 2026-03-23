import { OwnerCampaignDraftForm } from "@/components/campaigns/owner-campaign-draft-form";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

type PageProps = {
    searchParams: Promise<{ selectedIds?: string | string[] }>;
};

function normalizeSelectedIds(value: string | string[] | undefined) {
    if (!value) {
        return [];
    }

    const rawValues = Array.isArray(value) ? value : [value];
    return [
        ...new Set(
            rawValues
                .flatMap((item) => item.split(","))
                .map((id) => id.trim())
                .filter(Boolean)
        ),
    ];
}

export default async function NewCampaignPage({ searchParams }: PageProps) {
    const context = await requireSessionContext("owner");
    const params = await searchParams;
    const selectedIds = normalizeSelectedIds(params.selectedIds);

    return (
        <OwnerShell context={context}>
            <OwnerCampaignDraftForm selectedIds={selectedIds} />
        </OwnerShell>
    );
}
