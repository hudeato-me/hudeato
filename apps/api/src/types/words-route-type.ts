import { createDb } from "../db";
import { RedisParams } from "../lib/redis/redis";

// リポジトリ関数・サービス関数で使う型
export type Db = ReturnType<typeof createDb>;

export type WordsRouteVariables = {
	userId: string;
	db: Db;
	redisParams: RedisParams;
};
