import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: typeof window !== "undefined" ? `http://${window.location.hostname}:21391` : "http://localhost:21391",
});
