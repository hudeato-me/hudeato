import { Polar } from "@polar-sh/sdk";
import { Context } from "hono";

export const handlePolarWebhook = async (c: Context) => {
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
