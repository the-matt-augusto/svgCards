import { Provider, CardData, ProviderError, formatNumber, formatRepChange, fetchWithTimeout } from '../core';
import { isPlaceholder } from '../utils/config';

interface StackOverflowApiResponse {
  error_id?: number;
  error_message?: string;
  items?: Array<{
    display_name: string;
    reputation: number;
    badge_counts?: { gold?: number; silver?: number; bronze?: number };
    creation_date?: number;
    profile_image: string;
    reputation_change_year?: number;
    reputation_change_quarter?: number;
    reputation_change_month?: number;
  }>;
}

export class StackOverflowProvider implements Provider {
  async fetch(id: string): Promise<CardData> {
    const stackappsKey = process.env.STACKAPPS_KEY;
    let apiUrl = `https://api.stackexchange.com/2.3/users/${id}?site=stackoverflow`;
    if (stackappsKey && !isPlaceholder(stackappsKey)) {
      apiUrl += `&key=${encodeURIComponent(stackappsKey)}`;
    } else if (stackappsKey && isPlaceholder(stackappsKey)) {
      console.warn('[Config Warning] STACKAPPS_KEY contém placeholder de exemplo; ignorando chave.');
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(apiUrl, {
        headers: {
          'User-Agent': 'Vercel-StackOverflow-Card',
          'Accept': 'application/json',
        }
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError('unavailable', 'Serviço Indisponível', 'A solicitação ao Stack Overflow expirou (timeout).');
      }
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`[StackOverflow Network Error] ${msg}`);
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'Erro de rede ao acessar o Stack Overflow.');
    }

    if (!response.ok) {
      const errorBody = await response.clone().json().catch(() => null) as StackOverflowApiResponse | null;
      if (errorBody?.error_id) validateStackOverflowResponse(errorBody, id);
      const errText = await response.text();
      console.error(`[StackOverflow Error] Status ${response.status}: ${errText}`);
      if (response.status === 429) {
        throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições ao Stack Overflow atingido.');
      }
      if (response.status >= 500) {
        throw new ProviderError('unavailable', 'Serviço Indisponível', 'Stack Overflow indisponível.');
      }
      throw new ProviderError('unavailable', 'Serviço Indisponível', 'Erro ao consultar a API do Stack Overflow.');
    }

    const json = await response.json() as StackOverflowApiResponse;

    validateStackOverflowResponse(json, id);

    const user = json.items![0];
    const displayName = user.display_name;
    const reputation = user.reputation ?? 0;
    const badgeCounts = user.badge_counts || {};
    const creationDate = user.creation_date;
    const profileImage = user.profile_image;

    const repChangeYear = user.reputation_change_year ?? 0;
    const repChangeQuarter = user.reputation_change_quarter ?? 0;
    const repChangeMonth = user.reputation_change_month ?? 0;

    const memberSince = creationDate ? new Date(creationDate * 1000).getUTCFullYear() : new Date().getUTCFullYear();

    return {
      provider: 'stackoverflow',
      name: displayName,
      login: id,
      avatarUrl: profileImage,
      memberSince,
      badges: {
        gold: formatNumber(badgeCounts.gold ?? 0),
        silver: formatNumber(badgeCounts.silver ?? 0),
        bronze: formatNumber(badgeCounts.bronze ?? 0),
      },
      stats: [
        { label: 'Reputação', value: formatNumber(reputation) },
        { label: 'Este ano', value: formatRepChange(repChangeYear) },
        { label: 'Este trimestre', value: formatRepChange(repChangeQuarter) },
        { label: 'Este mês', value: formatRepChange(repChangeMonth) },
      ],
    };
  }
}

export function validateStackOverflowResponse(json: unknown, id: string): void {
  const r = json as { error_id?: number; error_message?: string; items?: unknown[] };
  if (r?.error_id) {
    // O corpo de erro da Stack Exchange pode ecoar a propria STACKAPPS_KEY
    // ("key 'xyz' is not valid"), entao fica apenas no log do servidor.
    const errMsg = r.error_message || 'Stack Exchange Error';
    console.error(`[StackExchange] error_id=${r.error_id}: ${errMsg}`);
    if (r.error_id === 502 || r.error_id === 403 || errMsg.toLowerCase().includes('throttle') || errMsg.toLowerCase().includes('rate limit')) {
      throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições ao Stack Overflow atingido.');
    }
    throw new ProviderError('unavailable', 'Serviço Indisponível', 'Serviço temporariamente indisponível.');
  }
  if (!r?.items || r.items.length === 0) {
    throw new ProviderError('not_found', 'User Not Found', `Stack Overflow user ID "${id}" does not exist.`);
  }
}
