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

// In-memory cache for Twitch OAuth Token within the serverless isolate
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let pendingTokenPromise: Promise<string> | null = null;

async function requestTwitchToken(clientId: string, clientSecret: string): Promise<string> {
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
    console.error(`[Twitch Auth Network Error] ${msg}`);
    throw new ProviderError('unavailable', 'Serviço Indisponível', 'Erro de rede na autenticação da Twitch.');
  }

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Twitch OAuth Error] Status ${res.status}: ${errorText}`);
    if (res.status === 429) {
      throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições na autenticação da Twitch atingido.');
    }
    if (res.status >= 500) {
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'Serviço de autenticação da Twitch indisponível.');
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', 'Falha na autenticação da Twitch.');
  }

  const json = await res.json() as TwitchTokenResponse;
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000; // 60-second safety buffer
  return cachedToken;
}

async function getTwitchToken(clientId: string, clientSecret: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  if (!forceRefresh && pendingTokenPromise) {
    return pendingTokenPromise;
  }

  pendingTokenPromise = requestTwitchToken(clientId, clientSecret).finally(() => {
    pendingTokenPromise = null;
  });

  return pendingTokenPromise;
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
    console.error(`[Twitch Network Error] ${msg}`);
    throw new ProviderError('unavailable', 'Serviço Indisponível', 'Erro de rede ao acessar a Twitch.');
  }

  if (res.status === 401) {
    // Retry once with a forced token refresh
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
      console.error(`[Twitch Network Error] ${msg}`);
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'Erro de rede ao acessar a Twitch.');
    }
  }

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Twitch API Error] Status ${res.status}: ${errorText}`);
    if (res.status === 429) {
      throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições à API da Twitch atingido.');
    }
    if (res.status >= 500) {
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'Twitch indisponível.');
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', 'Erro ao consultar a API da Twitch.');
  }

  return res.json();
}

export class TwitchProvider implements Provider {
  async fetch(id: string): Promise<CardData> {
    const twitchClientId = process.env.TWITCH_CLIENT_ID || '';
    const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET || '';

    // Parallel fetch for user identity and live stream status
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

    // Follower count query requires broadcaster ID; executed on best-effort basis
    let followersCount: number | null = null;
    try {
      const followersJson = await fetchTwitchHelix<TwitchFollowersResponse>(
        `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(twitchUser.id)}&first=1`,
        twitchClientId,
        twitchClientSecret
      );
      if (Number.isFinite(followersJson.total) && followersJson.total >= 0) {
        followersCount = followersJson.total;
      }
    } catch {
      followersCount = null;
    }

    const followerStats = followersCount === null
      ? []
      : [{ label: 'Seguidores', value: formatNumber(followersCount) }];

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
        streamTitle,
        stats: [
          ...followerStats,
          { label: 'Viewers', value: formatNumber(viewers) },
        ],
      };
    }

    return {
      provider: 'twitch',
      name: displayName,
      login: loginName,
      avatarUrl: profileImageUrl,
      isLive: false,
      stats: followerStats,
    };
  }
}

export function validateTwitchUserResponse(userJson: unknown, id: string): void {
  const r = userJson as { data?: unknown[] };
  if (!r?.data || r.data.length === 0) {
    throw new ProviderError('not_found', 'Channel Not Found', `Twitch channel "${id}" does not exist.`);
  }
}
