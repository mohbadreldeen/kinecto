import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is required");
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(databaseUrl);
    } catch {
        throw new Error(
            "DATABASE_URL is not a valid URL. Ensure it is a full postgres connection string and URL-encode special password characters (for example # as %23)."
        );
    }

    if (!parsedUrl.hostname || parsedUrl.hostname === "base") {
        throw new Error(
            "DATABASE_URL host is invalid. Check Vercel Environment Variables and use the Supabase pooled host (for example aws-*.pooler.supabase.com)."
        );
    }

    return databaseUrl;
}

function getPool() {
    if (!poolInstance) {
        poolInstance = new Pool({
            connectionString: getDatabaseUrl(),
        });
    }

    return poolInstance;
}

export function getDb() {
    if (!dbInstance) {
        dbInstance = drizzle(getPool(), { schema });
    }

    return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get(_target, prop, receiver) {
        return Reflect.get(getDb() as object, prop, receiver);
    },
});

export const pool = new Proxy({} as Pool, {
    get(_target, prop, receiver) {
        return Reflect.get(getPool() as object, prop, receiver);
    },
});
