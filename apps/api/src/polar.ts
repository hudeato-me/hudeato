import { Polar } from "@polar-sh/sdk";
import { Context } from "hono";

export const handlePolarWebhook = async (c: Context) => {
	// Polar クライアントは Webhook 検証実装(後続)で使用予定のため保持する
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const polar = new Polar({
		accessToken: c.env.POLAR_ACCESS_TOKEN,
	});

	const signature = c.req.header("polar-webhook-signature");
	if (!signature) {
		return c.json({ error: "No signature" }, 400);
	}

	const body = await c.req.text();
	// Verify signature logic would go here, or use SDK if supported
	// Currently SDK might not have webhook verification helper exposed directly or it's named differently.
	// For now, we'll just log and return 200.
	console.log("Polar webhook received", body);

	return c.json({ received: true });
};
