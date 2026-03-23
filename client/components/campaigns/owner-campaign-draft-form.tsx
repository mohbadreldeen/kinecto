"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
    useCampaignAudiencePreview,
    useCreateOwnerCampaign,
} from "@/lib/hooks/use-owner-campaigns";
import { useLocale } from "@/lib/i18n/use-locale";

type Props = {
    selectedIds: string[];
};

export function OwnerCampaignDraftForm({ selectedIds }: Props) {
    const router = useRouter();
    const createCampaign = useCreateOwnerCampaign();
    const audiencePreviewQuery = useCampaignAudiencePreview(selectedIds);

    const [name, setName] = useState("CRM Manual Campaign");
    const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
    const [templateBody, setTemplateBody] = useState(
        "Hi {{customer_name}}, you currently have {{points}} points."
    );
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const { t } = useLocale();

    const audienceCount = useMemo(() => {
        if (audiencePreviewQuery.data) {
            return audiencePreviewQuery.data.length;
        }

        return selectedIds.length;
    }, [audiencePreviewQuery.data, selectedIds.length]);

    async function handleSaveDraft() {
        setError(null);
        setSuccessMessage(null);

        if (selectedIds.length === 0) {
            setError(t("campaigns.noSelectedFromCrm"));
            return;
        }

        const trimmedName = name.trim();
        const trimmedTemplate = templateBody.trim();
        if (!trimmedName || !trimmedTemplate) {
            setError(t("campaigns.requiredFields"));
            return;
        }

        try {
            const created = await createCampaign.mutateAsync({
                name: trimmedName,
                channel,
                templateBody: trimmedTemplate,
                audienceType: "manual",
                audienceCriteria: {
                    selectedCustomerIds: selectedIds,
                },
            });

            setSuccessMessage(
                `${t("campaigns.draftCreated")} (${created.id}).`
            );
            router.refresh();
        } catch (mutationError) {
            setError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("campaigns.createDraftError")
            );
        }
    }

    return (
        <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("campaigns.manualEyebrow")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {t("campaigns.manualTitle")}
                    </h2>
                </div>
                <Link
                    href="/customers"
                    className="button rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                >
                    {t("campaigns.backCustomers")}
                </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">
                    {t("campaigns.audienceSize")}:{" "}
                    <span className="font-semibold">{audienceCount}</span>
                </p>
                {audiencePreviewQuery.isLoading ? (
                    <p className="mt-2 text-xs text-slate-500">
                        {t("campaigns.audiencePreviewLoading")}
                    </p>
                ) : audiencePreviewQuery.error ? (
                    <p className="mt-2 text-xs text-red-600">
                        {audiencePreviewQuery.error.message}
                    </p>
                ) : audiencePreviewQuery.data &&
                  audiencePreviewQuery.data.length > 0 ? (
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-600">
                        {audiencePreviewQuery.data.map((customer) => (
                            <li key={customer.id}>
                                {customer.name} · {customer.phone} ·{" "}
                                {customer.pointsBalance}{" "}
                                {t("dashboard.pointsSuffix")}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>

            <div className="grid gap-3">
                <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("campaigns.namePlaceholder")}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />

                <select
                    value={channel}
                    onChange={(event) =>
                        setChannel(event.target.value as "whatsapp" | "email")
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                </select>

                <textarea
                    value={templateBody}
                    onChange={(event) => setTemplateBody(event.target.value)}
                    placeholder={t("campaigns.templatePlaceholder")}
                    rows={6}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => void handleSaveDraft()}
                    disabled={createCampaign.isPending}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                    {createCampaign.isPending
                        ? t("settings.saving")
                        : t("campaigns.saveDraft")}
                </button>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {successMessage ? (
                <p className="text-sm text-emerald-700">{successMessage}</p>
            ) : null}
        </section>
    );
}
