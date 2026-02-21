import { createDb } from "../db";
import { RedisParams } from "../lib/redis/redis";

export type Db = ReturnType<typeof createDb>;

export type WordsRouteVariables = {
	userId: string;
	db: Db;
	redisParams: RedisParams;
};
