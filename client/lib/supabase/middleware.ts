import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith("/api");
    const isAuthPage = ["/login", "/signup", "/reset-password"].includes(
        pathname
    );
    const isDashboardRoute =
        pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    const isEmployeeWorkspaceRoute =
        pathname === "/employee" || pathname.startsWith("/employee/");
    const isEmployeesManagementRoute =
        pathname === "/employees" || pathname.startsWith("/employees/");
    const isProtectedPage =
        isDashboardRoute ||
        isEmployeeWorkspaceRoute ||
        isEmployeesManagementRoute;

    if (isApiRoute) {
        return response;
    }

    if (!user && isProtectedPage) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (!user) {
        return response;
    }

    const role = user.app_metadata.role as "owner" | "employee" | undefined;

    // Let auth pages decide whether to redirect based on active tenant membership.
    // This avoids loops for disabled users who still have a Supabase session cookie.
    if (isAuthPage) {
        return response;
    }

    if (
        (isDashboardRoute || isEmployeesManagementRoute) &&
        role === "employee"
    ) {
        return NextResponse.redirect(new URL("/employee", request.url));
    }

    if (isEmployeeWorkspaceRoute && role === "owner") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
}
