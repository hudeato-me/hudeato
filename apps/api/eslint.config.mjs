import config from "@hudeato/config/eslint.config.js";

// 共有 ESLint 設定に、API 固有の無視対象(生成物)を追加する
export default [
	...config,
	{
		ignores: [
			"dist",
			"node_modules",
			".wrangler",
			"worker-configuration.d.ts",
			"migrations",
		],
	},
];
