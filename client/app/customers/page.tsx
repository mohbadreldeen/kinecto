import { OwnerCustomersCrm } from "@/components/customers/owner-customers-crm";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
    const context = await requireSessionContext("owner");

    return (
        <OwnerShell context={context}>
            <OwnerCustomersCrm />
        </OwnerShell>
    );
}
