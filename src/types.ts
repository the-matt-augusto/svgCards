export interface ThemeConfig {
  bg: string;
  border: string;
  text: string;
  subtext: string;
  accent: string;
}

export interface StatItem {
  label: string;
  value: string;
}

export type ProviderType = 'github' | 'stackoverflow' | 'twitch';

export interface BaseCardData {
  provider: ProviderType;
  name: string;
  login: string;
  avatarUrl: string;
  stats: StatItem[];
}

export interface GitHubCardData extends BaseCardData {
  provider: 'github';
  memberSince: number;
  languages: Array<{ name: string; color: string }>;
}

export interface StackOverflowCardData extends BaseCardData {
  provider: 'stackoverflow';
  memberSince: number;
  badges: {
    gold: string;
    silver: string;
    bronze: string;
  };
}

export interface TwitchCardData extends BaseCardData {
  provider: 'twitch';
  isLive: boolean;
  game?: string;
  streamTitle?: string;
}

export type CardData = GitHubCardData | StackOverflowCardData | TwitchCardData;

export interface Provider {
  fetch(id: string): Promise<CardData>;
}

export type ProviderErrorCategory = 'not_found' | 'unavailable' | 'rate_limited';

export class ProviderError extends Error {
  title: string;
  category: ProviderErrorCategory;

  constructor(category: ProviderErrorCategory, title: string, message: string) {
    super(message);
    this.category = category;
    this.title = title;
    this.name = 'ProviderError';
  }
}
