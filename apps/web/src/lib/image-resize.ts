// 画像をJPEGに変換しつつ長辺をmaxDimensionに揃える
// HEIC等はブラウザがdecodeできれば自動でJPEG化される（Safari iOSはHEIC decode可）
export async function resizeImageToJpeg(
	file: File,
	maxDimension = 1024,
	quality = 0.85,
): Promise<File> {
	const bitmap = await createImageBitmap(file);
	try {
		const ratio = Math.min(maxDimension / bitmap.width, maxDimension / bitmap.height, 1);
		const w = Math.round(bitmap.width * ratio);
		const h = Math.round(bitmap.height * ratio);

		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas 2D context not available");
		ctx.drawImage(bitmap, 0, 0, w, h);

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", quality),
		);
		if (!blob) throw new Error("Failed to encode image");
		return new File([blob], "image.jpg", { type: "image/jpeg" });
	} finally {
		bitmap.close();
	}
}
