import { isDemo } from "./config";

export function thumbnailUrl(path?: string | null) {
  if (!path) return "";
  if (isDemo && path.startsWith("data:image/webp;base64,")) return path;
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(path)) return "";
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/booth-thumbnails/${path}`;
}

// Re-encode pixels, stripping metadata and limiting both dimensions and bytes.
export async function prepareThumbnail(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG, PNG, WebP 사진을 선택해 주세요.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("사진은 10MB 이하로 선택해 주세요.");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode().catch(() => {
      throw new Error("사진을 읽지 못했어요. 다른 사진을 선택해 주세요.");
    });
    const scale = Math.min(
      1,
      512 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서는 사진을 변환할 수 없어요.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (!blob || blob.type !== "image/webp")
      throw new Error(
        "WebP 변환을 지원하는 최신 Chrome 또는 Edge에서 사진을 올려 주세요.",
      );
    if (blob.size > 256 * 1024)
      throw new Error(
        "변환한 사진이 너무 커요. 더 단순하거나 작은 사진을 선택해 주세요.",
      );
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("사진 변환에 실패했어요."));
      reader.readAsDataURL(blob);
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}
