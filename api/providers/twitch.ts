import { Provider, CardData, ProviderError, formatNumber, fetchWithTimeout } from '../core';

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
}

interface TwitchUsersResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
  }>;
}

interface TwitchFollowersResponse {
  total: number;
}

interface TwitchStreamsResponse {
  data: Array<{
    title: string;
    game_name: string;
    viewer_count: number;
  }>;
}

// Global cache variables for Twitch OAuth Token
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getTwitchToken(clientId: string, clientSecret: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'A autenticação com a Twitch expirou (timeout).');
    }
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede na autenticação da Twitch: ${msg}`);
  }

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 429) {
      throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições na autenticação da Twitch atingido.');
    }
    if (res.status >= 500) {
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Serviço de autenticação da Twitch indisponível (Status ${res.status}).`);
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Falha na autenticação da Twitch (Status ${res.status}): ${errorText.length > 50 ? errorText.slice(0, 50) + '...' : errorText}`);
  }

  const json = await res.json() as TwitchTokenResponse;
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000; // Buffer de 60s
  return cachedToken;
}

async function fetchTwitchHelix<T>(url: string, clientId: string, clientSecret: string): Promise<T> {
  let token = await getTwitchToken(clientId, clientSecret);
  
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'A solicitação à Twitch expirou (timeout).');
    }
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede ao acessar a Twitch: ${msg}`);
  }

  if (res.status === 401) {
    // Tenta renovar o token e repetir uma vez
    token = await getTwitchToken(clientId, clientSecret, true);
    try {
      res = await fetchWithTimeout(url, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError('unavailable', 'Serviço Indisponível', 'A solicitação à Twitch expirou (timeout).');
      }
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede ao acessar a Twitch: ${msg}`);
    }
  }

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 429) {
      throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições à API da Twitch atingido.');
    }
    if (res.status >= 500) {
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Twitch indisponível (Status ${res.status}).`);
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro na API da Twitch (Status ${res.status}): ${errorText.length > 50 ? errorText.slice(0, 50) + '...' : errorText}`);
  }

  return res.json();
}

export class TwitchProvider implements Provider {
  async fetch(id: string): Promise<CardData> {
    const twitchClientId = process.env.TWITCH_CLIENT_ID || '';
    const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET || '';

    // user + stream são independentes: rodam em paralelo.
    // Promise.all: ambas críticas — user sem identidade, stream sem layout (live/offline).
    const [userJson, streamJson] = await Promise.all([
      fetchTwitchHelix<TwitchUsersResponse>(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(id)}`, twitchClientId, twitchClientSecret),
      fetchTwitchHelix<TwitchStreamsResponse>(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(id)}`, twitchClientId, twitchClientSecret),
    ]);

    validateTwitchUserResponse(userJson, id);

    const twitchUser = userJson.data[0];
    const displayName = twitchUser.display_name;
    const loginName = twitchUser.login;
    const profileImageUrl = twitchUser.profile_image_url;
    const isLive = streamJson.data.length > 0;

    // followers precisa de broadcaster_id (não pode ser paralelo a user) — best-effort.
    let followersCount = 0;
    try {
      const followersJson = await fetchTwitchHelix<TwitchFollowersResponse>(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(twitchUser.id)}&first=1`, twitchClientId, twitchClientSecret);
      followersCount = followersJson.total || 0;
    } catch {
      // best-effort: mantém 0
    }

    if (isLive) {
      const stream = streamJson.data[0];
      const streamTitle = stream.title || 'Sem título';
      const gameName = stream.game_name || 'Sem categoria';
      const viewers = stream.viewer_count || 0;

      return {
        provider: 'twitch',
        name: displayName,
        login: loginName,
        avatarUrl: profileImageUrl,
        isLive: true,
        game: gameName,
        streamTitle: streamTitle,
        stats: [
          { label: 'Seguidores', value: formatNumber(followersCount) },
          { label: 'Viewers', value: formatNumber(viewers) },
        ],
      };
    } else {
      return {
        provider: 'twitch',
        name: displayName,
        login: loginName,
        avatarUrl: profileImageUrl,
        isLive: false,
        stats: [
          { label: 'Seguidores', value: formatNumber(followersCount) },
        ],
      };
    }
  }
}

export function validateTwitchUserResponse(userJson: unknown, id: string): void {
  const r = userJson as { data?: unknown[] };
  if (!r?.data || r.data.length === 0) {
    throw new ProviderError('not_found', 'Channel Not Found', `Twitch channel "${id}" does not exist.`);
  }
}

