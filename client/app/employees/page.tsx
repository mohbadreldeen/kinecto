import { EmployeeInvitePanel } from "@/components/dashboard/employee-invite-panel";
import { OwnerEmployeesManagement } from "@/components/employees/owner-employees-management";
import { OwnerShell } from "@/components/layout/owner-shell";
import { requireSessionContext } from "@/lib/auth/session";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
    const context = await requireSessionContext("owner");

    return (
        <OwnerShell context={context}>
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                <OwnerEmployeesManagement />
                <EmployeeInvitePanel />
            </div>
        </OwnerShell>
    );
}
