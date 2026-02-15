import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./auth-schema"

export const createDb = (url: string, authToken?: string) => {
	const client = createClient({
		url,
		authToken,
	});
	return drizzle(client, { schema });
};

export * from "./auth-schema"; 
