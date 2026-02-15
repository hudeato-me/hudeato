import type { AppType } from "api";
import { hc } from "hono/client";

// Replace localhost with your machine's IP for physical device testing
export const client = hc<AppType>("http://localhost:8787");
