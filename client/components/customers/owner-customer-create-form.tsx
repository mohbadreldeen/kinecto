"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import { useCreateOwnerCustomer } from "@/lib/hooks/use-owner-customers";

export function OwnerCustomerCreateForm() {
    const router = useRouter();
    const createCustomer = useCreateOwnerCustomer();

    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [tags, setTags] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { t } = useLocale();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        try {
            const created = await createCustomer.mutateAsync({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim() || undefined,
                tags: tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                notes: notes.trim() || undefined,
            });

            setName("");
            setPhone("");
            setEmail("");
            setTags("");
            setNotes("");
            setIsOpen(false);
            router.push(`/customers/${created.id}`);
        } catch (submissionError) {
            setError(
                submissionError instanceof Error
                    ? submissionError.message
                    : t("customers.createError")
            );
        }
    }

    return (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                        {t("customers.addTitle")}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                        {t("customers.addSubtitle")}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setIsOpen((current) => !current);
                        setError(null);
                    }}
                    className="rounded-md bg-(--brand-accent) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                    {isOpen
                        ? t("customers.closeForm")
                        : t("customers.addCustomer")}
                </button>
            </div>

            {isOpen ? (
                <form
                    className="mt-5 grid gap-3 md:grid-cols-2"
                    onSubmit={handleSubmit}
                >
                    <input
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t("customers.fullName")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                    />
                    <input
                        required
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder={t("customers.phoneNumber")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                    />
                    <input
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t("customers.emailOptional")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                    />
                    <input
                        value={tags}
                        onChange={(event) => setTags(event.target.value)}
                        placeholder={t("customers.tagsCsv")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                    />
                    <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t("customers.notesOptional")}
                        rows={4}
                        className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                    />
                    <div className="md:col-span-2 flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={createCustomer.isPending}
                            className="rounded-md bg-(--brand-accent) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                            {createCustomer.isPending
                                ? t("customers.creating")
                                : t("customers.createCustomer")}
                        </button>
                        {error ? (
                            <p className="text-sm text-red-600">{error}</p>
                        ) : null}
                    </div>
                </form>
            ) : null}
        </section>
    );
}
