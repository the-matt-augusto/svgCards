import { Provider, CardData, ProviderError, formatNumber, fetchWithTimeout } from '../core';

interface StackOverflowApiResponse {
  error_id?: number;
  error_message?: string;
  items?: Array<{
    display_name: string;
    reputation: number;
    badge_counts: { gold: number; silver: number; bronze: number };
    creation_date: number;
    profile_image: string;
    reputation_change_year: number;
    reputation_change_quarter: number;
    reputation_change_month: number;
  }>;
}

function formatRepChange(change: number): string {
  if (change >= 0) {
    return `+${formatNumber(change)}`;
  }
  return formatNumber(change);
}

export class StackOverflowProvider implements Provider {
  async fetch(id: string): Promise<CardData> {
    const stackappsKey = process.env.STACKAPPS_KEY;
    let apiUrl = `https://api.stackexchange.com/2.3/users/${id}?site=stackoverflow`;
    if (stackappsKey) {
      apiUrl += `&key=${encodeURIComponent(stackappsKey)}`;
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
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede ao acessar o Stack Overflow: ${msg}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições ao Stack Overflow atingido.');
      }
      if (response.status >= 500) {
        throw new ProviderError('unavailable', 'Serviço Indisponível', `Stack Overflow indisponível (Status ${response.status}).`);
      }
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro na API do Stack Overflow (Status ${response.status}): ${errText.length > 50 ? errText.slice(0, 50) + '...' : errText}`);
    }

    const json = await response.json() as StackOverflowApiResponse;

    validateStackOverflowResponse(json, id);

    const user = json.items![0];
    const displayName = user.display_name;
    const reputation = user.reputation;
    const badgeCounts = user.badge_counts;
    const creationDate = user.creation_date;
    const profileImage = user.profile_image;

    const repChangeYear = user.reputation_change_year;
    const repChangeQuarter = user.reputation_change_quarter;
    const repChangeMonth = user.reputation_change_month;

    const memberSince = creationDate ? new Date(creationDate * 1000).getUTCFullYear() : new Date().getUTCFullYear();

    return {
      provider: 'stackoverflow',
      name: displayName,
      login: id,
      avatarUrl: profileImage,
      memberSince,
      badges: {
        gold: formatNumber(badgeCounts.gold),
        silver: formatNumber(badgeCounts.silver),
        bronze: formatNumber(badgeCounts.bronze),
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
    const errMsg = r.error_message || 'Stack Exchange Error';
    if (r.error_id === 502 || r.error_id === 403 || errMsg.toLowerCase().includes('throttle') || errMsg.toLowerCase().includes('rate limit')) {
      throw new ProviderError('rate_limited', 'Stack Exchange API Error', errMsg);
    }
    throw new ProviderError('unavailable', 'Stack Exchange API Error', errMsg);
  }
  if (!r?.items || r.items.length === 0) {
    throw new ProviderError('not_found', 'User Not Found', `Stack Overflow user ID "${id}" does not exist.`);
  }
}

