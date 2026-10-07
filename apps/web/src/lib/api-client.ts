import type { AppType } from "api";
import { hc } from "hono/client";

const baseURL = typeof window !== "undefined" ? `http://${window.location.hostname}:8787` : "http://localhost:8787";

export const client = hc<AppType>(baseURL, {
	// webとapiでポートが違くてもbetter-authがCookieセッションを使えるように設定
	init: { credentials: "include" },

	// 401を一括キャッチしてログイン画面へリダイレクト
	// protectedMiddleware関数で帰ってくる401をキャッチしてリダイレクトさせるための処理
	fetch: async (input: RequestInfo | URL, requestInit?: RequestInit) => {
		const res = await fetch(input, requestInit);
		if (res.status === 401) {
			console.error("セッションが切れました。ログイン画面に戻ります。");
			window.location.href = "/login";
		}
		return res;
	},
});
