import { EmailIntegrationForm } from "@/components/settings/email-integration-form";
import { PassKitIntegrationForm } from "@/components/settings/passkit-integration-form";
import { WhatsAppIntegrationForm } from "@/components/settings/whatsapp-integration-form";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export const metadata = { title: "Integrations" };

export default async function SettingsIntegrationsPage() {
    const context = await requireSessionContext("owner");

    return (
        <OwnerShell context={context}>
            <div className="grid gap-6">
                <WhatsAppIntegrationForm />
                <EmailIntegrationForm />
                <PassKitIntegrationForm />
            </div>
        </OwnerShell>
    );
}
