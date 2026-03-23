import { OwnerCustomerDetail } from "@/components/customers/owner-customer-detail";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export default async function CustomerDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const context = await requireSessionContext("owner");
    const resolvedParams = await params;

    return (
        <OwnerShell context={context}>
            <OwnerCustomerDetail customerId={resolvedParams.id} />
        </OwnerShell>
    );
}
