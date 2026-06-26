import { Provider, CardData, ProviderError, formatNumber, fetchWithTimeout } from '../core';

function formatRepChange(change: number): string {
  if (change >= 0) {
    return `+${formatNumber(change)}`;
  }
  return formatNumber(change);
}

export class StackOverflowProvider implements Provider {
  async fetch(id: string): Promise<CardData | null> {
    const stackappsKey = process.env.STACKAPPS_KEY;
    let apiUrl = `https://api.stackexchange.com/2.3/users/${id}?site=stackoverflow`;
    if (stackappsKey) {
      apiUrl += `&key=${stackappsKey}`;
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(apiUrl, {
        headers: {
          'User-Agent': 'Vercel-StackOverflow-Card',
          'Accept': 'application/json',
        }
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ProviderError('unavailable', 'Serviço Indisponível', 'A solicitação ao Stack Overflow expirou (timeout).');
      }
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede ao acessar o Stack Overflow: ${err.message}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições ao Stack Overflow atingido.');
      }
      if (response.status >= 500) {
        throw new ProviderError('unavailable', 'Serviço Indisponível', `Stack Overflow indisponível (Status ${response.status}).`);
      }
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro na API do Stack Overflow (Status ${response.status}): ${errText.slice(0, 50)}...`);
    }

    const json = await response.json() as any;

    validateStackOverflowResponse(json, id);

    const user = json.items[0];
    const displayName = user.display_name;
    const reputation = user.reputation || 0;
    const badgeCounts = user.badge_counts || { gold: 0, silver: 0, bronze: 0 };
    const creationDate = user.creation_date; // Epoch timestamp seconds
    const profileImage = user.profile_image;

    const repChangeYear = user.reputation_change_year || 0;
    const repChangeQuarter = user.reputation_change_quarter || 0;
    const repChangeMonth = user.reputation_change_month || 0;

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

export function validateStackOverflowResponse(json: any, id: string): void {
  if (json && json.error_id) {
    const errMsg = json.error_message || 'Stack Exchange Error';
    if (json.error_id === 502 || json.error_id === 403 || errMsg.toLowerCase().includes('throttle') || errMsg.toLowerCase().includes('rate limit')) {
      throw new ProviderError('rate_limited', 'Stack Exchange API Error', errMsg);
    }
    throw new ProviderError('unavailable', 'Stack Exchange API Error', errMsg);
  }
  if (!json || !json.items || json.items.length === 0) {
    throw new ProviderError('not_found', 'User Not Found', `Stack Overflow user ID "${id}" does not exist.`);
  }
}

