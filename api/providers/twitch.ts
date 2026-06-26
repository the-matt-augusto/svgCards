import { Provider, CardData, ProviderError, formatNumber, fetchWithTimeout } from '../core';

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
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'A autenticação com a Twitch expirou (timeout).');
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede na autenticação da Twitch: ${err.message}`);
  }

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 429) {
      throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições na autenticação da Twitch atingido.');
    }
    if (res.status >= 500) {
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Serviço de autenticação da Twitch indisponível (Status ${res.status}).`);
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Falha na autenticação da Twitch (Status ${res.status}): ${errorText.slice(0, 50)}...`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000; // Buffer de 60s
  return cachedToken;
}

async function fetchTwitchHelix(url: string, clientId: string, clientSecret: string): Promise<any> {
  let token = await getTwitchToken(clientId, clientSecret);
  
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'A solicitação à Twitch expirou (timeout).');
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede ao acessar a Twitch: ${err.message}`);
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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ProviderError('unavailable', 'Serviço Indisponível', 'A solicitação à Twitch expirou (timeout).');
      }
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede ao acessar a Twitch: ${err.message}`);
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
    throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro na API da Twitch (Status ${res.status}): ${errorText.slice(0, 50)}...`);
  }

  return res.json();
}

export class TwitchProvider implements Provider {
  async fetch(id: string): Promise<CardData | null> {
    const twitchClientId = process.env.TWITCH_CLIENT_ID || '';
    const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET || '';

    // 1. Obter informações básicas do usuário
    const userJson = await fetchTwitchHelix(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(id)}`, twitchClientId, twitchClientSecret);
    
    validateTwitchUserResponse(userJson, id);

    const twitchUser = userJson.data[0];
    const displayName = twitchUser.display_name;
    const loginName = twitchUser.login;
    const profileImageUrl = twitchUser.profile_image_url;

    // 1.5. Obter número de seguidores
    const followersJson = await fetchTwitchHelix(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${twitchUser.id}&first=1`, twitchClientId, twitchClientSecret);
    const followersCount = followersJson.total || 0;

    // 2. Obter informações de transmissão ao vivo
    const streamJson = await fetchTwitchHelix(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(id)}`, twitchClientId, twitchClientSecret);
    const isLive = streamJson.data && streamJson.data.length > 0;

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

export function validateTwitchUserResponse(userJson: any, id: string): void {
  if (!userJson || !userJson.data || userJson.data.length === 0) {
    throw new ProviderError('not_found', 'Channel Not Found', `Twitch channel "${id}" does not exist.`);
  }
}

