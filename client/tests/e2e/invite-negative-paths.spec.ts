import { expect, test } from "@playwright/test";

test.describe("Invite - Negative Paths", () => {
    test("shows missing token state on accept-invite page", async ({
        page,
    }) => {
        await page.goto("/accept-invite");

        await expect(
            page.getByRole("heading", { name: "Missing invite token" })
        ).toBeVisible();
    });

    test("rejects invalid invite token on acceptance", async ({ page }) => {
        await page.goto(
            "/accept-invite?token=not-a-real-token-that-is-long-enough"
        );

        await page.getByLabel("Full name").fill("Invalid Invite User");
        await page.getByLabel("Password").fill("EmployeePass123!");
        await page.getByRole("button", { name: "Accept invite" }).click();

        await expect(
            page.getByText("Invitation is invalid or expired")
        ).toBeVisible();
    });

    test("shows error when creating duplicate active invite", async ({
        page,
    }) => {
        const suffix = Date.now();
        const ownerEmail = `owner-negative-${suffix}@kinecto.test`;
        const ownerPassword = "OwnerPass123!";
        const duplicateEmail = `employee-duplicate-${suffix}@kinecto.test`;

        await page.goto("/signup");

        await page.getByLabel("Business name").fill(`Kinecto Test ${suffix}`);
        await page.getByLabel("Full name").fill("Negative Test Owner");
        await page.getByLabel("Work email").fill(ownerEmail);
        await page.getByLabel("Password").fill(ownerPassword);
        await page.getByRole("button", { name: "Create workspace" }).click();

        await expect(page).toHaveURL(/\/dashboard$/);

        await page
            .getByPlaceholder("employee@demo-cafe.test")
            .fill(duplicateEmail);
        await page
            .getByPlaceholder("Employee name (optional)")
            .fill("First Invite");
        await page.getByRole("button", { name: "Create invite" }).click();

        await expect(page.getByLabel("Employee invite link")).toBeVisible();

        await page
            .getByPlaceholder("employee@demo-cafe.test")
            .fill(duplicateEmail);
        await page
            .getByPlaceholder("Employee name (optional)")
            .fill("Second Invite Attempt");
        await page.getByRole("button", { name: "Create invite" }).click();

        await expect(
            page.getByText("An active invite already exists for this email")
        ).toBeVisible();
    });
});
