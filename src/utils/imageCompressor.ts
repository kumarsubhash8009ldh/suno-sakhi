/**
 * Client-Side High-Efficiency Image Compressor
 * Resizes images to avatar-friendly dimensions (e.g. 400x400) and compresses to JPEG (~30KB)
 * Prevents localStorage QuotaExceededError and Firestore 1MB document size limit errors.
 */

export const compressImageFile = (
  file: File | Blob,
  maxDimension = 400,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate aspect ratio
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          // Smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with given quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          console.warn('Canvas compression failed, falling back to raw data URL', err);
          resolve(event.target?.result as string);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsDataURL(file);
  });
};
