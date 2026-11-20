import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { Request } from 'express';
import sharp from 'sharp';
import { BadRequestError } from '../../utils/errors.js';

// Base directory for local uploads
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const SELLER_DOCS_DIR = path.join(UPLOADS_ROOT, 'seller-documents');
const WAREHOUSE_DOCS_DIR = path.join(UPLOADS_ROOT, 'warehouse-documents');
const PRODUCT_ASSETS_DIR = path.join(UPLOADS_ROOT, 'product-assets');
const BRAND_IMAGES_DIR = path.join(UPLOADS_ROOT, 'brand-images');
const BANNER_IMAGES_DIR = path.join(UPLOADS_ROOT, 'banner-images');
const CATEGORY_IMAGES_DIR = path.join(UPLOADS_ROOT, 'category-images');

// Ensure upload directories exist
if (!fs.existsSync(SELLER_DOCS_DIR)) {
  fs.mkdirSync(SELLER_DOCS_DIR, { recursive: true });
}
if (!fs.existsSync(WAREHOUSE_DOCS_DIR)) {
  fs.mkdirSync(WAREHOUSE_DOCS_DIR, { recursive: true });
}
if (!fs.existsSync(PRODUCT_ASSETS_DIR)) {
  fs.mkdirSync(PRODUCT_ASSETS_DIR, { recursive: true });
}
if (!fs.existsSync(BRAND_IMAGES_DIR)) {
  fs.mkdirSync(BRAND_IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(BANNER_IMAGES_DIR)) {
  fs.mkdirSync(BANNER_IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(CATEGORY_IMAGES_DIR)) {
  fs.mkdirSync(CATEGORY_IMAGES_DIR, { recursive: true });
}

export interface ProcessedAssetResult {
  filename: string;
  relativeUrl: string;
  size: number;
  assetType: 'IMAGE' | 'VIDEO';
  width?: number;
  height?: number;
}

export interface IStorageService {
  saveFile(file: Express.Multer.File, subDir?: string): Promise<{ filename: string; relativeUrl: string; size: number }>;
  processAndSaveProductAsset(file: Express.Multer.File): Promise<ProcessedAssetResult>;
  deleteFile(relativeUrl: string): Promise<boolean>;
}

export class LocalStorageService implements IStorageService {
  async saveFile(file: Express.Multer.File, subDir: string = 'seller-documents'): Promise<{ filename: string; relativeUrl: string; size: number }> {
    return {
      filename: file.filename,
      relativeUrl: `/uploads/${subDir}/${file.filename}`,
      size: file.size,
    };
  }

  async processAndSaveProductAsset(file: Express.Multer.File): Promise<ProcessedAssetResult> {
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);

    // 1. Video processing
    if (isVideo) {
      if (file.size > 50 * 1024 * 1024) {
        if (file.path && fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path).catch(() => {});
        }
        throw new BadRequestError(`Video size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 50 MB.`);
      }

      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
      const finalFilename = `prod-video-${uniqueSuffix}${ext}`;
      const finalPath = path.join(PRODUCT_ASSETS_DIR, finalFilename);

      await fs.promises.rename(file.path, finalPath);

      return {
        filename: finalFilename,
        relativeUrl: `/uploads/product-assets/${finalFilename}`,
        size: file.size,
        assetType: 'VIDEO',
      };
    }

    // 2. Image processing
    if (file.size > 10 * 1024 * 1024) {
      if (file.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      throw new BadRequestError(`Image size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 10 MB.`);
    }

    try {
      const metadata = await sharp(file.path).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      // Minimum resolution gate
      if (width < 800 || height < 800) {
        await fs.promises.unlink(file.path).catch(() => {});
        throw new BadRequestError(
          `Image resolution too low (${width}x${height}px). Minimum required is 800x800px for high-definition zoom.`
        );
      }

      // Aspect ratio sanity check (between 1:2 and 2:1)
      const ratio = width / height;
      if (ratio < 0.5 || ratio > 2.0) {
        await fs.promises.unlink(file.path).catch(() => {});
        throw new BadRequestError(
          `Invalid aspect ratio (${width}x${height}). Accepted aspect ratio must be between 1:2 (0.5) and 2:1 (2.0) to avoid distortion.`
        );
      }

      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const webpFilename = `prod-${uniqueSuffix}.webp`;
      const webpFullPath = path.join(PRODUCT_ASSETS_DIR, webpFilename);

      // Downscale to max 1200x1200 while preserving aspect ratio and converting to WebP (82% quality)
      await sharp(file.path)
        .rotate() // auto-orient based on EXIF
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside', // preserves aspect ratio without stretching
          withoutEnlargement: true, // don't upscale images between 800 and 1200
        })
        .webp({
          quality: 82,
          effort: 4,
        })
        .toFile(webpFullPath);

      // Clean up raw temp file
      if (fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }

      const stat = await fs.promises.stat(webpFullPath);

      return {
        filename: webpFilename,
        relativeUrl: `/uploads/product-assets/${webpFilename}`,
        size: stat.size,
        assetType: 'IMAGE',
        width,
        height,
      };
    } catch (err: any) {
      if (fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      if (err instanceof BadRequestError) {
        throw err;
      }
      throw new BadRequestError(`Failed to process image: ${err.message || 'Corrupt or unsupported image'}`);
    }
  }

  async deleteFile(relativeUrl: string): Promise<boolean> {
    try {
      const normalizedPath = relativeUrl.replace(/^\/uploads\//, '');
      const fullPath = path.join(UPLOADS_ROOT, normalizedPath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const storageService = new LocalStorageService();

// Allowed MIME types for business KYC and facility compliance documents
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

// Configure Multer disk storage for seller documents
const diskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, SELLER_DOCS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

// Configure Multer disk storage for warehouse documents
const warehouseDiskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, WAREHOUSE_DOCS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `wh-doc-${uniqueSuffix}${ext}`);
  },
});

export const documentUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported file type: ${file.mimetype}. Allowed types: PDF, JPEG, PNG, WEBP.`));
    }
  },
});

export const warehouseDocumentUpload = multer({
  storage: warehouseDiskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported file type: ${file.mimetype}. Allowed types: PDF, JPEG, PNG, WEBP.`));
    }
  },
});

// Configure Multer disk storage for product assets
const productAssetDiskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, PRODUCT_ASSETS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `prod-temp-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_PRODUCT_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export const productAssetUpload = multer({
  storage: productAssetDiskStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB maximum (for videos; images verified to 10MB in processing)
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    if (ALLOWED_PRODUCT_MEDIA_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported media type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, GIF, MP4, WEBM, QuickTime (MOV).`));
    }
  },
});

// Configure Multer disk storage for brand images
const brandImageDiskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, BRAND_IMAGES_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `brand-${uniqueSuffix}${ext}`);
  },
});

export const brandImageUpload = multer({
  storage: brandImageDiskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported image type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, GIF.`));
    }
  },
});

// Configure Multer disk storage for promotional banner images
const bannerImageDiskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, BANNER_IMAGES_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `banner-${uniqueSuffix}${ext}`);
  },
});

export const bannerImageUpload = multer({
  storage: bannerImageDiskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported image type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, GIF.`));
    }
  },
});

// Configure Multer disk storage for root/subcategory images
const categoryImageDiskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, CATEGORY_IMAGES_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `cat-${uniqueSuffix}${ext}`);
  },
});

export const categoryImageUpload = multer({
  storage: categoryImageDiskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported image type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, GIF.`));
    }
  },
});


