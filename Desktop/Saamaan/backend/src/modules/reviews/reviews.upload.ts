import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

export const REVIEW_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'reviews');

if (!fs.existsSync(REVIEW_UPLOADS_DIR)) {
  fs.mkdirSync(REVIEW_UPLOADS_DIR, { recursive: true });
}

// Use in-memory buffer storage so sharp can process and convert before saving to disk
const storage = multer.memoryStorage();

export const uploadReviewPhotos = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per image
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and AVIF image formats are allowed'));
    }
  },
});

/**
 * Converts an image file buffer into an optimized WebP format and saves it to disk.
 * - Standardizes image orientation based on EXIF.
 * - Resizes proportionally if exceeds 1600x1600 (without upscaling smaller images).
 * - Encodes as WebP with 80% quality for optimal visual clarity & tiny file size.
 * @returns The relative public URL path: /uploads/reviews/review-[id].webp
 */
export async function processAndSaveReviewImage(file: Express.Multer.File): Promise<string> {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const filename = `review-${unique}.webp`;
  const destinationPath = path.join(REVIEW_UPLOADS_DIR, filename);

  await sharp(file.buffer)
    .rotate() // Auto-orient image based on EXIF rotation tag
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80, effort: 4 })
    .toFile(destinationPath);

  return `/uploads/reviews/${filename}`;
}
