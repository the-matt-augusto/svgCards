import { fonts } from '../constants';
import { ThemeConfig } from '../types';
import { escapeXml } from '../utils/xml';

export interface AvatarRenderOptions {
  avatarUrl: string;
  name: string;
  login: string;
  theme: ThemeConfig;
  opacity?: number;
  textColor?: string;
  borderColor?: string;
}

/**
 * Returns the SVG defs required for card clip paths.
 */
export function renderCardDefs(): string {
  return `  <defs>
    <clipPath id="avatar-clip">
      <circle cx="70" cy="65" r="40" />
    </clipPath>
  </defs>`;
}

/**
 * Returns the standard card background rectangle.
 */
export function renderCardBackground(theme: ThemeConfig): string {
  return `  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>`;
}

/**
 * Renders an avatar circle and image or fallback initial text with proper unicode/emoji support.
 */
export function renderAvatar(options: AvatarRenderOptions): string {
  const { avatarUrl, name, login, theme, opacity, textColor, borderColor } = options;
  const cleanAvatarUrl = escapeXml(avatarUrl);
  const rawInitial = ([...(name || login || '?')][0] ?? '?').toUpperCase();
  const avatarInitial = escapeXml(rawInitial);

  const strokeColor = borderColor || theme.accent;
  const initialColor = textColor || theme.accent;
  const avatarCircleFill = cleanAvatarUrl ? 'none' : theme.border;

  const opacityAttr = opacity !== undefined ? ` opacity="${opacity}"` : '';
  const avatarElement = cleanAvatarUrl
    ? `<image xlink:href="${cleanAvatarUrl}" x="30" y="25" width="80" height="80" clip-path="url(#avatar-clip)"${opacityAttr} />`
    : `<text x="70" y="65" dy="0.35em" font-family="${fonts}" font-size="36" font-weight="bold" fill="${initialColor}" text-anchor="middle">${avatarInitial}</text>`;

  return `  <circle cx="70" cy="65" r="41" fill="${avatarCircleFill}" stroke="${strokeColor}" stroke-width="2" />
  ${avatarElement}`;
}
