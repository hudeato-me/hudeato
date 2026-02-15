import { createClient } from "@libsql/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/libsql";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as schema from "../db/auth-schema";

// ---------------------------------------------------------------------------
// In-memory Redis mock for secondaryStorage
// ---------------------------------------------------------------------------
const createInMemoryStorage = () => {
	const store = new Map<string, { value: string; expiresAt?: number }>();

	return {
		get: async (key: string) => {
			const entry = store.get(key);
			if (!entry) return null;
			if (entry.expiresAt && Date.now() > entry.expiresAt) {
				store.delete(key);
				return null;
			}
			return entry.value;
		},
		set: async (key: string, value: string, ttl?: number) => {
			store.set(key, {
				value,
				expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
			});
		},
		delete: async (key: string) => {
			store.delete(key);
		},
		/** テストヘルパー: ストアを全消去 */
		_clear: () => store.clear(),
	};
};

// ---------------------------------------------------------------------------
// テスト用DB & Auth のセットアップ
// ---------------------------------------------------------------------------
const MIGRATION_SQL_PATH = path.resolve(
	__dirname,
	"../../migrations/0000_tiny_killraven.sql",
);

export interface TestContext {
	auth: ReturnType<typeof betterAuth>;
	dbPath: string;
	storage: ReturnType<typeof createInMemoryStorage>;
	cleanup: () => void;
}

/**
 * テスト用のAuth + DBインスタンスを生成する。
 * 各テストスイート（describe）ごとに呼び出して独立環境を確保する。
 */
export function createTestContext(): TestContext {
	// 一時ファイルDBを作成
	const dbPath = path.join(os.tmpdir(), `hudeato-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

	const client = createClient({ url: `file:${dbPath}` });
	const db = drizzle(client, { schema });

	// マイグレーション適用（同期的にSQLを読み込んでexecute）
	const migrationSql = fs.readFileSync(MIGRATION_SQL_PATH, "utf-8");
	// statement-breakpoint で分割して実行
	const statements = migrationSql
		.split("--\u003e statement-breakpoint")
		.map((s) => s.trim())
		.filter(Boolean);

	const storage = createInMemoryStorage();

	const auth = betterAuth({
		database: drizzleAdapter(db, { provider: "sqlite" }),
		secondaryStorage: storage,
		emailAndPassword: { enabled: true },
		plugins: [openAPI()],
		baseURL: "http://localhost/api/auth",
		secret: "test-secret-key-for-integration-tests",
		trustedOrigins: ["http://localhost"],
	});

	const cleanup = () => {
		try {
			client.close();
		} catch {
			// ignore
		}
		try {
			fs.unlinkSync(dbPath);
			// WAL/SHM files
			fs.unlinkSync(`${dbPath}-wal`);
			fs.unlinkSync(`${dbPath}-shm`);
		} catch {
			// ignore
		}
		storage._clear();
	};

	return {
		auth,
		dbPath,
		storage,
		cleanup,
		/** @internal マイグレーション用 */
		_applyMigrations: async () => {
			for (const stmt of statements) {
				await client.execute(stmt);
			}
		},
	} as TestContext & { _applyMigrations: () => Promise<void> };
}
