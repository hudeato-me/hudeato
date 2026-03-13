import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Bindings, WordsRouteVariables } from "../types";
import { handleZodError } from "../utils/error-validator";
import { getDashboard } from "../modules/word/service";

const dashboard = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()
	// /api/dashboardのroute
	.get(
		"/summary",
		// クエリパラメータの検証
		// 後々フィルタなどを実装する可能性が有るので、クエリパラメータで
		zValidator("query", z.object({ wordSetId: z.string() }), handleZodError),
		async (c) => {
			const { wordSetId } = c.req.valid("query");
			const summary = await getDashboard(
				c.get("db"),
				c.get("userId"),
				wordSetId,
			);
			return c.json(summary);
		},
	);

export default dashboard;