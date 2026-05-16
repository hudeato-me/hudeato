import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
	const [isLightboxOpen, setIsLightboxOpen] = useState(false);
	const previewUrl = imageKey ? getImageUrl(imageKey) : null;

	const handlePick = () => {
		setErrorMessage(null);
		fileInputRef.current?.click();
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;

		setIsUploading(true);
		setErrorMessage(null);
		try {
			const jpegFile = await resizeImageToJpeg(file);
			const newKey = await uploadImage(jpegFile);
			onChange(newKey);
			haptic("success");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Upload failed";
			setErrorMessage(message);
			haptic("error");
		} finally {
			setIsUploading(false);
		}
	};

	const handleDelete = () => {
		if (!imageKey) return;
		const keyToDelete = imageKey;
		onChange(null);
		setIsLightboxOpen(false);
		haptic("heavy");
		deleteImage(keyToDelete).catch(() => { });
	};

	const openLightbox = () => {
		haptic("light");
		setIsLightboxOpen(true);
	};

	const closeLightbox = () => setIsLightboxOpen(false);

	// ライトボックス表示中は背景スクロールを止める
	useEffect(() => {
		if (!isLightboxOpen) return;
		const original = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => { document.body.style.overflow = original; };
	}, [isLightboxOpen]);

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
				<button
					type="button"
					onClick={openLightbox}
					className="block w-full rounded-3xl overflow-hidden border border-gray-200 bg-gray-50 active:opacity-90 transition-opacity"
				>
					{previewUrl ? (
						<img src={previewUrl} alt="" className="w-full max-h-80 object-contain pointer-events-none" />
					) : (
						<div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm">
							画像を表示できません
						</div>
					)}
				</button>
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

			{/* ライトボックス: ドロワー(transform持ち)のviewport束縛を回避するためPortalでbody直下に */}
			{isLightboxOpen && previewUrl && typeof document !== "undefined" && createPortal(
				<div
					className="fixed inset-0 z-[1000] bg-black flex flex-col"
					role="dialog"
					aria-modal="true"
				>
					{/* 上部ツールバー */}
					<div className="grid grid-cols-3 items-center px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
						<button
							type="button"
							onClick={closeLightbox}
							className="w-10 h-10 flex items-center justify-start text-white active:scale-95 transition-transform"
							aria-label="閉じる"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
						<div className="text-white text-sm text-center select-none">1/1</div>
						<button
							type="button"
							onClick={handleDelete}
							className="w-10 h-10 flex items-center justify-end text-white active:scale-95 transition-transform ml-auto"
							aria-label="削除"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
								<path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</div>

					{/* 中央: 画像 (タップでも閉じる) */}
					<button
						type="button"
						onClick={closeLightbox}
						className="flex-1 flex items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),1rem)] min-h-0 cursor-default"
						aria-label="閉じる"
					>
						<img
							src={previewUrl}
							alt=""
							className="max-w-full max-h-full object-contain pointer-events-none"
						/>
					</button>
				</div>,
				document.body
			)}
		</div>
	);
}
