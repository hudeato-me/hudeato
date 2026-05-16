import { useRef, useState } from "react";
import { resizeImageToJpeg } from "~/lib/image-resize";
import { deleteImage, getImageUrl, uploadImage } from "~/hooks/use-image-upload";
import { haptic } from "~/lib/haptic";

interface ImagePickerProps {
	imageKey: string | null;
	onChange: (next: string | null) => void;
}

export function ImagePicker({ imageKey, onChange }: ImagePickerProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const previewUrl = imageKey ? getImageUrl(imageKey) : null;

	const handlePick = () => {
		setErrorMessage(null);
		fileInputRef.current?.click();
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		// 同じファイルを再度選んでも change が発火するように毎回リセット
		e.target.value = "";
		if (!file) return;

		setIsUploading(true);
		setErrorMessage(null);
		const previousKey = imageKey;
		try {
			const jpegFile = await resizeImageToJpeg(file);
			const newKey = await uploadImage(jpegFile);
			onChange(newKey);
			haptic("success");
			// 古い画像があれば削除（失敗しても続行）
			if (previousKey) {
				deleteImage(previousKey).catch(() => { });
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Upload failed";
			setErrorMessage(message);
			haptic("error");
		} finally {
			setIsUploading(false);
		}
	};

	const handleRemove = async () => {
		if (!imageKey) return;
		const keyToDelete = imageKey;
		onChange(null);
		haptic("light");
		// 楽観的に先に表示を消してから削除（失敗しても元には戻さない）
		deleteImage(keyToDelete).catch(() => { });
	};

	const hasImage = !!imageKey;

	return (
		<div className="space-y-2">
			<input
				ref={fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
				className="hidden"
				onChange={handleFileChange}
			/>

			{hasImage ? (
				<div className="relative w-full rounded-3xl overflow-hidden border border-gray-200 bg-gray-50">
					{previewUrl ? (
						<img src={previewUrl} alt="" className="w-full max-h-80 object-contain" />
					) : (
						<div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm">
							画像を表示できません
						</div>
					)}
					<button
						type="button"
						onClick={handleRemove}
						className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-95 transition-transform"
						aria-label="画像を削除"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
					<button
						type="button"
						onClick={handlePick}
						disabled={isUploading}
						className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs active:scale-95 transition-transform disabled:opacity-50"
					>
						{isUploading ? "アップロード中..." : "差し替え"}
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={handlePick}
					disabled={isUploading}
					className="w-full border border-gray-200 rounded-3xl h-32 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors gap-2 disabled:opacity-50"
				>
					{isUploading ? (
						<span className="text-sm">アップロード中...</span>
					) : (
						<>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
								<circle cx="8.5" cy="8.5" r="1.5" />
								<polyline points="21 15 16 10 5 21" />
							</svg>
							<span className="text-sm">写真を追加</span>
						</>
					)}
				</button>
			)}

			{errorMessage && (
				<p className="text-xs text-red-500 ml-1">{errorMessage}</p>
			)}
		</div>
	);
}
