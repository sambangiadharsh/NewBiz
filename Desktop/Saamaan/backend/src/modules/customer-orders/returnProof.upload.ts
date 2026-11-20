import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const baseUploads = fs.existsSync(path.join(process.cwd(), 'backend', 'uploads'))
  ? path.join(process.cwd(), 'backend', 'uploads')
  : path.join(process.cwd(), 'uploads');

export const RETURN_UPLOADS_DIR = path.join(baseUploads, 'returns');

if (!fs.existsSync(RETURN_UPLOADS_DIR)) {
  fs.mkdirSync(RETURN_UPLOADS_DIR, { recursive: true });
}

// In-memory buffer storage so sharp can process, auto-orient, and optimize before disk write
const storage = multer.memoryStorage();

export const uploadReturnProofs = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // up to 5 photos
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    if (allowed.includes(file.mimetype.toLowerCase()) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and AVIF image formats are supported for damage proof.'));
    }
  },
});

/**
 * Standardizes customer return/replacement proof image:
 * - Auto-orients EXIF rotation (especially photos from smartphones).
 * - Resizes max dimensions to 1920x1920 (without enlarging smaller images).
 * - Encodes to optimized WebP format with quality 80 for fast admin review & low storage footprint.
 * @returns Relative public URL path: /uploads/returns/proof-[id].webp
 */
export async function processAndSaveReturnProofImage(file: Express.Multer.File): Promise<string> {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const filename = `proof-${unique}.webp`;
  const destinationPath = path.join(RETURN_UPLOADS_DIR, filename);

  await sharp(file.buffer)
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80, effort: 4 })
    .toFile(destinationPath);

  return `/uploads/returns/${filename}`;
}

