"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
    useAdjustCustomerPoints,
    useCreateEmployeeCustomer,
    useEmployeeCustomerProfileWithTransactions,
    useEmployeeCustomerSearch,
    useLookupCustomerByQr,
} from "@/lib/hooks/use-employee-customers";
import { useLocale } from "@/lib/i18n/use-locale";

const SEARCH_DEBOUNCE_MS = 300;

export function CustomerSearchPanel() {
    const { locale, t } = useLocale();
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
        null
    );
    const [pointsAmount, setPointsAmount] = useState("10");
    const [pointsNote, setPointsNote] = useState("");
    const [pointsError, setPointsError] = useState<string | null>(null);
    const [qrCodeInput, setQrCodeInput] = useState("");
    const [qrError, setQrError] = useState<string | null>(null);
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [newCustomerEmail, setNewCustomerEmail] = useState("");
    const [newCustomerError, setNewCustomerError] = useState<string | null>(
        null
    );
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [scannerSupported, setScannerSupported] = useState(true);
    const [txFromInput, setTxFromInput] = useState("");
    const [txToInput, setTxToInput] = useState("");
    const [appliedTxFrom, setAppliedTxFrom] = useState<string | undefined>(
        undefined
    );
    const [appliedTxTo, setAppliedTxTo] = useState<string | undefined>(
        undefined
    );

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timeoutId);
    }, [searchInput]);

    const searchQuery = useEmployeeCustomerSearch(debouncedSearch);
    const customers = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

    const effectiveSelectedCustomerId = useMemo(() => {
        if (selectedCustomerId) {
            return selectedCustomerId;
        }

        return customers[0]?.id ?? null;
    }, [customers, selectedCustomerId]);

    const transactionQueryOptions = useMemo(
        () => ({
            txPageSize: 10,
            txFrom: appliedTxFrom,
            txTo: appliedTxTo,
        }),
        [appliedTxFrom, appliedTxTo]
    );

    const profileQuery = useEmployeeCustomerProfileWithTransactions(
        effectiveSelectedCustomerId,
        transactionQueryOptions
    );
    const adjustPoints = useAdjustCustomerPoints(effectiveSelectedCustomerId);
    const createCustomer = useCreateEmployeeCustomer();
    const lookupByQr = useLookupCustomerByQr();

    const profileData = profileQuery.data?.pages[0] ?? null;
    const transactionItems =
        profileQuery.data?.pages.flatMap((page) => page.recentTransactions) ??
        [];

    async function handleAdjustPoints(type: "credit" | "debit") {
        setPointsError(null);

        const parsedAmount = Number(pointsAmount);
        if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
            setPointsError(t("employee.pointsError"));
            return;
        }

        try {
            await adjustPoints.mutateAsync({
                type,
                amount: parsedAmount,
                note:
                    pointsNote.trim().length > 0
                        ? pointsNote.trim()
                        : undefined,
            });
            setPointsNote("");
        } catch (mutationError) {
            setPointsError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("employee.pointsUpdateError")
            );
        }
    }

    function applyTransactionFilters() {
        setAppliedTxFrom(
            txFromInput
                ? new Date(`${txFromInput}T00:00:00.000Z`).toISOString()
                : undefined
        );
        setAppliedTxTo(
            txToInput
                ? new Date(`${txToInput}T23:59:59.999Z`).toISOString()
                : undefined
        );
    }

    function clearTransactionFilters() {
        setTxFromInput("");
        setTxToInput("");
        setAppliedTxFrom(undefined);
        setAppliedTxTo(undefined);
    }

    async function handleQrLookup(value?: string) {
        setQrError(null);

        const qrCode = (value ?? qrCodeInput).trim();
        if (!qrCode) {
            setQrError(t("employee.qrMissing"));
            return;
        }

        try {
            const result = await lookupByQr.mutateAsync(qrCode);
            setSelectedCustomerId(result.id);
            setQrCodeInput(qrCode);
            setSearchInput("");
        } catch (error) {
            setQrError(
                error instanceof Error
                    ? error.message
                    : t("employee.qrLookupError")
            );
        }
    }

    async function handleCreateCustomer() {
        setNewCustomerError(null);

        const name = newCustomerName.trim();
        const phone = newCustomerPhone.trim();
        const email = newCustomerEmail.trim();

        if (!name || !phone) {
            setNewCustomerError(t("employee.newCustomerRequired"));
            return;
        }

        try {
            const created = await createCustomer.mutateAsync({
                name,
                phone,
                email: email.length > 0 ? email : undefined,
            });

            setSelectedCustomerId(created.id);
            setSearchInput("");
            setDebouncedSearch("");
            setShowNewCustomerForm(false);
            setNewCustomerName("");
            setNewCustomerPhone("");
            setNewCustomerEmail("");
        } catch (error) {
            setNewCustomerError(
                error instanceof Error
                    ? error.message
                    : t("employee.newCustomerError")
            );
        }
    }

    async function startCameraScan() {
        if (typeof window === "undefined") {
            return;
        }

        const BarcodeDetectorCtor = (
            window as unknown as {
                BarcodeDetector?: new (options: { formats: string[] }) => {
                    detect: (
                        source: ImageBitmapSource
                    ) => Promise<Array<{ rawValue?: string }>>;
                };
            }
        ).BarcodeDetector;

        if (!navigator.mediaDevices?.getUserMedia || !BarcodeDetectorCtor) {
            setScannerSupported(false);
            setQrError(t("employee.qrUnsupported"));
            return;
        }

        setScannerSupported(true);
        setQrError(null);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
        }

        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        setIsCameraActive(true);

        scanIntervalRef.current = window.setInterval(async () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2) {
                return;
            }

            const detections = await detector.detect(video);
            const value = detections[0]?.rawValue?.trim();

            if (value) {
                stopCameraScan();
                await handleQrLookup(value);
            }
        }, 500);
    }

    function stopCameraScan() {
        if (scanIntervalRef.current !== null) {
            window.clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setIsCameraActive(false);
    }

    useEffect(() => {
        return () => {
            if (scanIntervalRef.current !== null) {
                window.clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    return (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-slate-950">
                    {t("employee.customerLookup")}
                </h2>
                <p className="text-sm text-slate-600">
                    {t("employee.customerLookupSubtitle")}
                </p>
            </div>

            <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("employee.searchPlaceholder")}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-(--brand-accent)"
            />

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("employee.newCustomer")}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setShowNewCustomerForm((current) => !current);
                            setNewCustomerError(null);
                        }}
                        className="rounded-md bg-(--brand-accent) px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                        {showNewCustomerForm
                            ? t("common.close")
                            : `+ ${t("employee.newCustomer")}`}
                    </button>
                </div>

                {showNewCustomerForm ? (
                    <div className="mt-3 space-y-2">
                        <input
                            type="text"
                            value={newCustomerName}
                            onChange={(event) =>
                                setNewCustomerName(event.target.value)
                            }
                            placeholder={t("customers.fullName")}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                        />
                        <input
                            type="tel"
                            value={newCustomerPhone}
                            onChange={(event) =>
                                setNewCustomerPhone(event.target.value)
                            }
                            placeholder={t("customers.phoneNumber")}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                        />
                        <input
                            type="email"
                            value={newCustomerEmail}
                            onChange={(event) =>
                                setNewCustomerEmail(event.target.value)
                            }
                            placeholder={t("customers.emailOptional")}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                        />
                        <button
                            type="button"
                            disabled={createCustomer.isPending}
                            onClick={() => void handleCreateCustomer()}
                            className="rounded-md bg-(--brand-accent) px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                            {createCustomer.isPending
                                ? t("employee.registering")
                                : t("employee.registerCustomer")}
                        </button>
                        {newCustomerError ? (
                            <p className="text-sm text-red-600">
                                {newCustomerError}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("employee.qrLookup")}
                </p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                    <input
                        type="text"
                        value={qrCodeInput}
                        onChange={(event) => setQrCodeInput(event.target.value)}
                        placeholder={t("employee.qrPlaceholder")}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                    />
                    <button
                        type="button"
                        disabled={lookupByQr.isPending}
                        onClick={() => void handleQrLookup()}
                        className="rounded-md bg-(--brand-accent) px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                        {lookupByQr.isPending
                            ? t("employee.finding")
                            : t("employee.findByQr")}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            isCameraActive
                                ? stopCameraScan()
                                : void startCameraScan()
                        }
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                    >
                        {isCameraActive
                            ? t("employee.stopCamera")
                            : t("employee.scanWithCamera")}
                    </button>
                </div>
                {isCameraActive ? (
                    <video
                        ref={videoRef}
                        className="mt-3 w-full rounded-md border border-slate-200 bg-black"
                        muted
                        playsInline
                    />
                ) : null}
                {!scannerSupported ? (
                    <p className="mt-2 text-xs text-slate-500">
                        {t("employee.cameraUnavailable")}
                    </p>
                ) : null}
                {qrError ? (
                    <p className="mt-2 text-sm text-red-600">{qrError}</p>
                ) : null}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <div className="rounded-xl border border-slate-100">
                    <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("employee.results")}
                        </p>
                    </div>

                    {searchQuery.isLoading ? (
                        <p className="px-4 py-4 text-sm text-slate-500">
                            {t("employee.loadingCustomers")}
                        </p>
                    ) : searchQuery.error ? (
                        <p className="px-4 py-4 text-sm text-red-600">
                            {searchQuery.error.message}
                        </p>
                    ) : customers.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-slate-500">
                            {t("employee.noCustomers")}
                        </p>
                    ) : (
                        <ul className="max-h-96 overflow-y-auto">
                            {customers.map((customer) => {
                                const isActive =
                                    customer.id === effectiveSelectedCustomerId;

                                return (
                                    <li key={customer.id}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedCustomerId(
                                                    customer.id
                                                )
                                            }
                                            className={`w-full border-b border-slate-100 px-4 py-3 text-left transition ${
                                                isActive
                                                    ? "border-l-4 border-l-(--brand-accent) bg-slate-50"
                                                    : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <p className="text-sm font-semibold text-slate-900">
                                                {customer.name}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {customer.phone}
                                            </p>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <article className="rounded-xl border border-slate-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("employee.profile")}
                    </p>

                    {!effectiveSelectedCustomerId ? (
                        <p className="mt-3 text-sm text-slate-500">
                            {t("employee.selectCustomer")}
                        </p>
                    ) : profileQuery.isLoading ? (
                        <p className="mt-3 text-sm text-slate-500">
                            {t("employee.loadingProfile")}
                        </p>
                    ) : profileQuery.error ? (
                        <p className="mt-3 text-sm text-red-600">
                            {profileQuery.error.message}
                        </p>
                    ) : profileData ? (
                        <div className="mt-3 space-y-3 text-sm text-slate-700">
                            <div>
                                <p className="text-lg font-semibold text-slate-950">
                                    {profileData.name}
                                </p>
                                <p className="text-slate-500">
                                    {profileData.phone}
                                </p>
                                {profileData.email ? (
                                    <p className="text-slate-500">
                                        {profileData.email}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                                <div>
                                    <p className="text-xs uppercase text-slate-500">
                                        {t("employee.points")}
                                    </p>
                                    <p
                                        aria-label="Points balance"
                                        className="font-semibold text-slate-900"
                                    >
                                        {profileData.pointsBalance}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-slate-500">
                                        {t("employee.status")}
                                    </p>
                                    <p
                                        aria-label="Customer status"
                                        className="font-semibold capitalize text-slate-900"
                                    >
                                        {profileData.status === "active"
                                            ? t("common.active")
                                            : t("common.inactive")}
                                    </p>
                                </div>
                            </div>

                            {profileData.tags.length > 0 ? (
                                <div>
                                    <p className="text-xs uppercase text-slate-500">
                                        {t("employee.tags")}
                                    </p>
                                    <p className="mt-1 text-slate-700">
                                        {profileData.tags.join(", ")}
                                    </p>
                                </div>
                            ) : null}

                            {profileData.notes ? (
                                <div>
                                    <p className="text-xs uppercase text-slate-500">
                                        {t("employee.notes")}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-slate-700">
                                        {profileData.notes}
                                    </p>
                                </div>
                            ) : null}

                            <div className="space-y-2 rounded-lg border border-slate-100 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {t("employee.updatePoints")}
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="pointsAmount"
                                            className="text-xs uppercase text-slate-500"
                                        >
                                            {t("employee.amount")}
                                        </label>
                                        <input
                                            id="pointsAmount"
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={pointsAmount}
                                            onChange={(event) =>
                                                setPointsAmount(
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="pointsNote"
                                            className="text-xs uppercase text-slate-500"
                                        >
                                            {t("employee.noteOptional")}
                                        </label>
                                        <input
                                            id="pointsNote"
                                            type="text"
                                            value={pointsNote}
                                            onChange={(event) =>
                                                setPointsNote(
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={adjustPoints.isPending}
                                        onClick={() =>
                                            void handleAdjustPoints("credit")
                                        }
                                        className="rounded-md bg-(--brand-accent) px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                    >
                                        {adjustPoints.isPending
                                            ? t("employee.updating")
                                            : t("employee.addPoints")}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={adjustPoints.isPending}
                                        onClick={() =>
                                            void handleAdjustPoints("debit")
                                        }
                                        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                                    >
                                        {adjustPoints.isPending
                                            ? t("employee.updating")
                                            : t("employee.deductPoints")}
                                    </button>
                                </div>
                                {pointsError ? (
                                    <p className="text-sm text-red-600">
                                        {pointsError}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2 rounded-lg border border-slate-100 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {t("employee.transactions")}
                                </p>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="txFrom"
                                            className="text-xs uppercase text-slate-500"
                                        >
                                            {t("employee.fromDate")}
                                        </label>
                                        <input
                                            id="txFrom"
                                            type="date"
                                            value={txFromInput}
                                            onChange={(event) =>
                                                setTxFromInput(
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="txTo"
                                            className="text-xs uppercase text-slate-500"
                                        >
                                            {t("employee.toDate")}
                                        </label>
                                        <input
                                            id="txTo"
                                            type="date"
                                            value={txToInput}
                                            onChange={(event) =>
                                                setTxToInput(event.target.value)
                                            }
                                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-(--brand-accent)"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={applyTransactionFilters}
                                        className="rounded-md bg-(--brand-accent) px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                                    >
                                        {t("employee.applyFilters")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearTransactionFilters}
                                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                                    >
                                        {t("common.clear")}
                                    </button>
                                </div>

                                {transactionItems.length === 0 ? (
                                    <p className="text-sm text-slate-500">
                                        {t("employee.noTransactions")}
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {transactionItems.map((transaction) => (
                                            <li
                                                key={transaction.id}
                                                className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs font-semibold uppercase text-slate-600">
                                                        {transaction.type ===
                                                        "credit"
                                                            ? t(
                                                                  "transaction.credit"
                                                              )
                                                            : t(
                                                                  "transaction.debit"
                                                              )}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(
                                                            transaction.createdAt
                                                        ).toLocaleString(
                                                            locale
                                                        )}
                                                    </p>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-800">
                                                    {transaction.type ===
                                                    "credit"
                                                        ? "+"
                                                        : "-"}
                                                    {transaction.amount}{" "}
                                                    {t(
                                                        "dashboard.pointsSuffix"
                                                    )}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {t(
                                                        "customers.detail.balanceAfter"
                                                    )}
                                                    : {transaction.balanceAfter}
                                                </p>
                                                {transaction.note ? (
                                                    <p className="mt-1 text-xs text-slate-600">
                                                        {transaction.note}
                                                    </p>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {profileQuery.hasNextPage ? (
                                    <button
                                        type="button"
                                        disabled={
                                            profileQuery.isFetchingNextPage
                                        }
                                        onClick={() =>
                                            void profileQuery.fetchNextPage()
                                        }
                                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                                    >
                                        {profileQuery.isFetchingNextPage
                                            ? t("campaigns.loadingOne")
                                            : t("customers.detail.loadMore")}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </article>
            </div>
        </section>
    );
}
