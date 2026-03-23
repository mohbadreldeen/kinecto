import { OwnerWalletManagement } from "@/components/wallet/owner-wallet-management";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
    const context = await requireSessionContext("owner");

    return (
        <OwnerShell context={context}>
            <OwnerWalletManagement />
        </OwnerShell>
    );
}
