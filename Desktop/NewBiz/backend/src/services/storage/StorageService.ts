import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { Request } from 'express';
import { BadRequestError } from '../../utils/errors.js';

// Base directory for local uploads
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const SELLER_DOCS_DIR = path.join(UPLOADS_ROOT, 'seller-documents');
const WAREHOUSE_DOCS_DIR = path.join(UPLOADS_ROOT, 'warehouse-documents');
const PRODUCT_ASSETS_DIR = path.join(UPLOADS_ROOT, 'product-assets');
const BRAND_IMAGES_DIR = path.join(UPLOADS_ROOT, 'brand-images');
const BANNER_IMAGES_DIR = path.join(UPLOADS_ROOT, 'banner-images');

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

export interface IStorageService {
  saveFile(file: Express.Multer.File, subDir?: string): Promise<{ filename: string; relativeUrl: string; size: number }>;
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
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `prod-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const productAssetUpload = multer({
  storage: productAssetDiskStorage,
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

