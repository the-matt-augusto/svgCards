import { ThemeConfig } from './types';
import { safeHex } from './utils/color';

export const themes = {
  light:      { bg: "#ffffff", border: "#d0d7de", text: "#1f2328", subtext: "#656d76", accent: "#0969da" },
  dark:       { bg: "#0d1117", border: "#30363d", text: "#e6edf3", subtext: "#8b949e", accent: "#58a6ff" },
  nord:       { bg: "#2e3440", border: "#434c5e", text: "#eceff4", subtext: "#81a1c1", accent: "#88c0d0" },
  gruvbox:    { bg: "#282828", border: "#504945", text: "#ebdbb2", subtext: "#a89984", accent: "#fabd2f" },
  tokyonight: { bg: "#1a1b26", border: "#292e42", text: "#c0caf5", subtext: "#565f89", accent: "#7aa2f7" },
  onedark:    { bg: "#282c34", border: "#3e4451", text: "#abb2bf", subtext: "#5c6370", accent: "#61afef" },
  spotify:    { bg: "#191414", border: "#282828", text: "#ffffff", subtext: "#b3b3b3", accent: "#1db954" },
  youtube:    { bg: "#0f0f0f", border: "#282828", text: "#ffffff", subtext: "#aaaaaa", accent: "#ff0000" },
  cyberpunk:  { bg: "#0c0813", border: "#ff0055", text: "#ffe600", subtext: "#9d7cd8", accent: "#00f0ff" },
  twitch:     { bg: "#0d0c0f", border: "#9146ff", text: "#f5f5f7", subtext: "#adadb8", accent: "#9146ff" },
} as const;

export type ThemeName = keyof typeof themes;

export const COLOR_KEYS: (keyof ThemeConfig)[] = ['bg', 'border', 'text', 'subtext', 'accent'];

/**
 * Resolves a requested theme name against the palette dictionary and applies custom color overrides.
 */
export function resolveTheme(
  themeParam: string | null | undefined,
  getCustomColor: (key: keyof ThemeConfig) => string | null | undefined
): ThemeConfig {
  const requested = String(themeParam ?? 'dark').toLowerCase();
  const baseTheme = Object.hasOwn(themes, requested)
    ? themes[requested as ThemeName]
    : themes.dark;

  const theme: ThemeConfig = { ...baseTheme };

  for (const key of COLOR_KEYS) {
    const val = getCustomColor(key);
    if (safeHex(val)) {
      theme[key] = `#${val}`;
    }
  }

  return theme;
}
