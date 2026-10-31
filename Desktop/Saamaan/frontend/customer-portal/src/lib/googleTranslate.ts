export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  badge: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', badge: 'EN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', badge: 'HI' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', badge: 'TA' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', badge: 'TE' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', badge: 'KN' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', badge: 'OR' },
];

const STORAGE_KEY = 'saamaan_preferred_language';

/**
 * Returns currently active language code ('en', 'hi', 'ta', etc.)
 */
export function getActiveLanguage(): string {
  try {
    // 1. Check Google Translate cookie (format: /en/hi, /auto/ta, etc.)
    const cookieMatch = document.cookie.match(/(?:^|;\s*)googtrans=\/[a-zA-Z-]+\/([a-zA-Z-]+)/);
    if (cookieMatch && cookieMatch[1]) {
      const code = cookieMatch[1].toLowerCase();
      if (SUPPORTED_LANGUAGES.some((lang) => lang.code === code)) {
        return code;
      }
    }

    // 2. Check localStorage fallback
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((lang) => lang.code === saved)) {
      return saved;
    }
  } catch (err) {
    console.error('Error reading active language:', err);
  }
  return 'en';
}

/**
 * Set the Google Translate language and seamlessly apply it
 */
export function setLanguage(code: string): void {
  try {
    const targetCode = code.toLowerCase();
    localStorage.setItem(STORAGE_KEY, targetCode);

    const hostname = window.location.hostname;
    const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');

    if (targetCode === 'en') {
      // Clear or set to default english
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'googtrans=/en/en; path=/;';
      if (!isLocalhost && hostname) {
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${hostname}; path=/;`;
        document.cookie = `googtrans=/en/en; domain=.${hostname}; path=/;`;
      }
    } else {
      document.cookie = `googtrans=/en/${targetCode}; path=/;`;
      if (!isLocalhost && hostname) {
        document.cookie = `googtrans=/en/${targetCode}; domain=.${hostname}; path=/;`;
      }
    }

    // Trigger select element if Google widget is loaded
    const selectEl = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (selectEl) {
      selectEl.value = targetCode;
      selectEl.dispatchEvent(new Event('change'));
      // Slight delay for translation, if switching to english or if DOM didn't update, reload cleanly
      if (targetCode === 'en') {
        setTimeout(() => window.location.reload(), 150);
      }
    } else {
      window.location.reload();
    }
  } catch (err) {
    console.error('Error setting language:', err);
    window.location.reload();
  }
}
