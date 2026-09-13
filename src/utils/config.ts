import { ProviderType } from '../types';

/**
 * Checks if an environment variable value is absent, empty, or an example placeholder.
 */
export function isPlaceholder(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (trimmed.endsWith('_here') || trimmed.startsWith('your_')) return true;
  return false;
}

export interface ConfigValidationResult {
  valid: boolean;
  message: string;
}

/**
 * Validates required configuration and credentials for the specified provider at startup/request time.
 * Emits actionable error logs to console.error without leaking credentials or variables to the user.
 */
export function validateProviderConfig(providerName: ProviderType): ConfigValidationResult {
  if (providerName === 'github') {
    const token = process.env.GITHUB_TOKEN;
    if (isPlaceholder(token)) {
      console.error('[Config Error] GITHUB_TOKEN obrigatório não configurado ou contém placeholder do .env.example.');
      return {
        valid: false,
        message: 'Serviço temporariamente indisponível.',
      };
    }
  }

  if (providerName === 'twitch') {
    const twitchClientId = process.env.TWITCH_CLIENT_ID;
    const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (isPlaceholder(twitchClientId) || isPlaceholder(twitchClientSecret)) {
      console.error('[Config Error] TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET ausente ou contém placeholder do .env.example.');
      return {
        valid: false,
        message: 'Serviço temporariamente indisponível.',
      };
    }
  }

  if (providerName === 'stackoverflow') {
    const stackappsKey = process.env.STACKAPPS_KEY;
    if (stackappsKey && isPlaceholder(stackappsKey)) {
      console.warn('[Config Warning] STACKAPPS_KEY contém valor placeholder do .env.example; requisições continuarão sem chave.');
    }
  }

  return { valid: true, message: '' };
}
