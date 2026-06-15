import { Context } from "hono";

// Zodはエラーレスポンスの型をRPCに共有しないため、フロントエンドにエラー内容を返すためにこの関数を定義する
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleZodError = (result: any, c: Context) => {
  if (!result.success) {
    // Zodのエラーを詳細に返す処理
    return c.json({
      error: "Validation Error",
      details: result.error.flatten().fieldErrors,
    }, 400);
  }
};