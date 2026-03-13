import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as authSchema from "./auth-schema";
import * as wordSchema from "./word-schema";

const schema = {
	...authSchema,
	...wordSchema,
};

export const createDb = (url: string, authToken?: string) => {
	const client = createClient({
		url,
		authToken,
	});
	return drizzle(client, { schema });
};

export * from "./auth-schema";
export * from "./word-schema";
