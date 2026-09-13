export const fonts = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const CARD_DIMENSIONS = {
  width: 450,
  height: 225,
  errorHeight: 150,
  borderRadius: 16,
} as const;

export const CACHE_SETTINGS = {
  twitch: {
    maxAge: 60,
    staleWhileRevalidate: 600,
  },
  default: {
    maxAge: 1800,
    staleWhileRevalidate: 86400,
  },
} as const;
