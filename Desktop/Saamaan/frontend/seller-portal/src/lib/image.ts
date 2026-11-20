/**
 * Normalizes an asset or image URL by prefixing the backend host if it is a relative path.
 * Handles both absolute URLs (e.g. S3, CDN, https://) and local server paths (e.g. /uploads/returns/...).
 */
export const getFullAssetUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string' || url.trim() === '') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(
    /\/api\/v1\/?$/,
    ''
  );
  return `${apiBase}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
};

