// Downscales and re-encodes an uploaded photo into a compact JPEG data URL before it's
// stored as a product's imageUrl. A raw phone photo can be several MB as base64 — well
// past Express's request body limit and Vercel's hard ~4.5mb serverless cap — and would
// silently fail to save (see apiApp.ts). Capping dimensions/quality keeps this to roughly
// 100-300kb while still looking sharp at the small sizes it's actually displayed at.
export function compressImage(file: File, maxDimension = 800, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
