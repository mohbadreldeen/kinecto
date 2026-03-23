import { expect, test } from "@playwright/test";

test("signup, login, redirect, sign-out, invite acceptance", async ({
    page,
}) => {
    const suffix = Date.now();
    const ownerEmail = `owner-${suffix}@kinecto.test`;
    const ownerPassword = "OwnerPass123!";
    const employeeEmail = `employee-${suffix}@kinecto.test`;
    const employeePassword = "EmployeePass123!";

    await page.goto("/signup");

    await page.getByLabel("Business name").fill(`Kinecto Cafe ${suffix}`);
    await page.getByLabel("Full name").fill("Demo Owner");
    await page.getByLabel("Work email").fill(ownerEmail);
    await page.getByLabel("Password").fill(ownerPassword);
    await page.getByRole("button", { name: "Create workspace" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Work email").fill(ownerEmail);
    await page.getByLabel("Password").fill(ownerPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByPlaceholder("employee@demo-cafe.test").fill(employeeEmail);
    await page
        .getByPlaceholder("Employee name (optional)")
        .fill("Demo Employee");
    await page.getByRole("button", { name: "Create invite" }).click();

    const inviteLink = await page
        .getByLabel("Employee invite link")
        .inputValue();

    await expect(inviteLink).toContain("/accept-invite?token=");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(inviteLink);

    await page.getByLabel("Full name").fill("Demo Employee");
    await page.getByLabel("Password").fill(employeePassword);
    await page.getByRole("button", { name: "Accept invite" }).click();

    await expect(page).toHaveURL(/\/employee$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
});
