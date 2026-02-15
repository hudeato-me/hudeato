import { Hono } from "hono";
import { cors } from "hono/cors";
import getAuth from "./lib/auth/auth";
import { handlePolarWebhook } from "./polar";
import { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
	"*",
	cors({
		origin: ["http://localhost:3000", "http://localhost:5173"], // Add your client URLs
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

app.onError((err, c) => {
	console.error("Global Error Handler:", err);
	return c.text("Internal Server Error", 500);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	console.log("Request to /api/auth/*");
	console.log("DB URL:", c.env.TURSO_DATABASE_URL);
	try {
		const auth = getAuth(c);
		return auth.handler(c.req.raw);
	} catch (e) {
		console.error("Error in auth handler:", e);
		throw e;
	}
});

app.post("/api/webhooks/polar", handlePolarWebhook);

app.get("/", (c) => {
	return c.text("Hello Hono on Cloudflare Workers!");
});

app.get("/health", (c) => {
	return c.json({ status: "ok" });
});

app.get("/api/protected", async (c) => {
	const auth = getAuth(c);
	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	return c.json({
		message: "This is protected data",
		user: session.user,
	});
});

export default app;
export type AppType = typeof app;
