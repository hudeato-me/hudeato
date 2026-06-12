const apiBase =
	typeof window !== "undefined"
		? `http://${window.location.hostname}:8787`
		: "http://localhost:8787";

// 画像アップロード: FileをR2へPOST → objectKeyを返す
export async function uploadImage(file: File): Promise<string> {
	const fd = new FormData();
	fd.append("image", file);
	const res = await fetch(`${apiBase}/api/v1/upload`, {
		method: "POST",
		body: fd,
		credentials: "include",
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({})) as { error?: string };
		throw new Error(body.error ?? `Upload failed (${res.status})`);
	}
	const json = (await res.json()) as { data: { objectKey: string } };
	return json.data.objectKey;
}

// 画像削除
export async function deleteImage(objectKey: string): Promise<void> {
	const res = await fetch(`${apiBase}/api/v1/upload/${objectKey}`, {
		method: "DELETE",
		credentials: "include",
	});
	if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}

export function getImageUrl(objectKey: string): string {
	return `${apiBase}/api/v1/upload/${objectKey}`;
}
