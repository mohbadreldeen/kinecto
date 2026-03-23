import { expect, test } from "@playwright/test";

test("employee can search customer and view profile", async ({ page }) => {
    const suffix = Date.now();
    const ownerEmail = `owner-search-${suffix}@kinecto.test`;
    const ownerPassword = "OwnerPass123!";
    const employeePassword = "EmployeePass123!";
    const employeeEmail = `employee-search-${suffix}@kinecto.test`;
    const customerName = `Search Customer ${suffix}`;
    const customerPhone = `+2010${String(suffix).slice(-6)}`;

    await page.goto("/signup");

    await page.getByLabel("Business name").fill(`Search Cafe ${suffix}`);
    await page.getByLabel("Full name").fill("Search Owner");
    await page.getByLabel("Work email").fill(ownerEmail);
    await page.getByLabel("Password").fill(ownerPassword);
    await page.getByRole("button", { name: "Create workspace" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByPlaceholder("employee@demo-cafe.test").fill(employeeEmail);
    await page
        .getByPlaceholder("Employee name (optional)")
        .fill("Search Employee");
    await page.getByRole("button", { name: "Create invite" }).click();

    const inviteLink = await page
        .getByLabel("Employee invite link")
        .inputValue();
    await expect(inviteLink).toContain("/accept-invite?token=");

    const createdCustomerId = await page.evaluate(
        async ({ name, phone }) => {
            const response = await fetch("/api/customers", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    phone,
                }),
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const payload = (await response.json()) as {
                data?: { id?: string };
            };

            if (!payload.data?.id) {
                throw new Error("Customer id missing from create response");
            }

            return payload.data.id;
        },
        { name: customerName, phone: customerPhone }
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(inviteLink);

    await page.getByLabel("Full name").fill("Search Employee");
    await page.getByLabel("Password").fill(employeePassword);
    await page.getByRole("button", { name: "Accept invite" }).click();

    await expect(page).toHaveURL(/\/employee$/);

    await page
        .getByPlaceholder("Paste scanned QR value")
        .fill(`kinecto://customer/${createdCustomerId}`);
    await page.getByRole("button", { name: "Find by QR" }).click();

    await expect(
        page.getByRole("article").getByText(customerName)
    ).toBeVisible();

    await page
        .getByPlaceholder("Search by name or phone")
        .fill(customerName.slice(0, 12));

    const profileCard = page.getByRole("article");

    await expect(
        page.getByRole("button", { name: customerName })
    ).toBeVisible();
    await expect(profileCard.getByText(customerPhone)).toBeVisible();
    await expect(profileCard.getByLabel("Points balance")).toHaveText("0");

    await page.getByLabel("Amount").fill("15");
    await page.getByLabel("Note (optional)").fill("Welcome bonus");
    await page.getByRole("button", { name: "Add points" }).click();
    await expect(profileCard.getByLabel("Points balance")).toHaveText("15");
    await expect(profileCard.getByText("Credit")).toBeVisible();
    await expect(profileCard.getByText("Welcome bonus")).toBeVisible();

    await page.getByLabel("Amount").fill("5");
    await page.getByLabel("Note (optional)").fill("Redeem");
    await page.getByRole("button", { name: "Deduct points" }).click();
    await expect(profileCard.getByLabel("Points balance")).toHaveText("10");
    await expect(profileCard.getByText("Debit")).toBeVisible();
    await expect(profileCard.getByText("Redeem")).toBeVisible();
});
