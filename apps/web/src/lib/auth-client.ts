import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: typeof window !== "undefined" ? `http://${window.location.hostname}:8787` : "http://localhost:8787",
});
