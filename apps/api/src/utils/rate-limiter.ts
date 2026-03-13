import { createMiddleware } from "hono/factory";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "../lib/redis/redis";
import { Bindings, WordsRouteVariables } from "../types";

export const rateLimiter = createMiddleware<{
    Bindings: Bindings;
    Variables: WordsRouteVariables;
}>(async (c, next) => {
    const redisParams = c.var.redisParams;
    if (!redisParams) {
        return next();
    }

    const redis = getRedis(redisParams);
    // レイトリミットを設ける関数を定義
    const ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        ephemeralCache: new Map(),
    });
    // ユーザーIDを取得
    const identifier = c.get("userId");
    if (!identifier) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    // 取得したユーザーIDに対してレイトリミットを適用
    const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
    // レイトリミットのヘッダーを設定
    c.header("X-RateLimit-Limit", limit.toString());
    c.header("X-RateLimit-Remaining", remaining.toString());
    c.header("X-RateLimit-Reset", reset.toString());
    // レイトリミットを超えていたらエラーを返す
    if (!success) {
        return c.json({ error: "Too Many Requests" }, 429);
    }

    await next();
});
