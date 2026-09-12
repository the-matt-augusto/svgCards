import { describe, it, expect } from 'vitest';
import { ProviderError } from '../api/core';
import { calculateStreak, validateGitHubResponse } from '../api/providers/github';
import { validateStackOverflowResponse } from '../api/providers/stackoverflow';
import { validateTwitchUserResponse } from '../api/providers/twitch';

describe('GitHub Provider - calculateStreak', () => {
  it('should handle case: hoje zerado conta ate ontem', () => {
    const days = [
      { contributionCount: 1 },
      { contributionCount: 2 },
      { contributionCount: 0 } // Hoje
    ];
    expect(calculateStreak(days)).toBe(2);
  });

  it('should handle case: tudo zerado', () => {
    const days = [
      { contributionCount: 0 },
      { contributionCount: 0 },
      { contributionCount: 0 }
    ];
    expect(calculateStreak(days)).toBe(0);
  });

  it('should handle case: sequencia quebrada no meio', () => {
    const days = [
      { contributionCount: 1 },
      { contributionCount: 0 }, // Sequência quebrada aqui
      { contributionCount: 2 }  // Hoje
    ];
    expect(calculateStreak(days)).toBe(1);
  });
});

describe('GitHub Provider - validateGitHubResponse', () => {
  it('should not throw on valid response', () => {
    const json = { data: { user: { login: 'octocat' } } };
    expect(() => validateGitHubResponse(json, 'octocat')).not.toThrow();
  });

  it('should throw "User Not Found" when user is null', () => {
    const json = { data: { user: null } };
    expect(() => validateGitHubResponse(json, 'invalid-user')).toThrowError(
      new ProviderError('not_found', 'User Not Found', 'GitHub user "invalid-user" does not exist.')
    );
  });

  it('should report unavailable when data/user is missing', () => {
    const json = {};
    expect(() => validateGitHubResponse(json, 'invalid-user')).toThrowError(
      new ProviderError('unavailable', 'GitHub API Error', 'Resposta inválida da API do GitHub.')
    );
  });

  it('should throw not_found (not unavailable) for the real GitHub shape: errors NOT_FOUND + data.user null', () => {
    const json = {
      data: { user: null },
      errors: [{ type: 'NOT_FOUND', message: "Could not resolve to a User with the login of 'invalid-user'." }],
    };
    expect(() => validateGitHubResponse(json, 'invalid-user')).toThrowError(
      new ProviderError('not_found', 'User Not Found', 'GitHub user "invalid-user" does not exist.')
    );
  });

  it('should throw rate_limited when GraphQL errors contain rate limit message', () => {
    const json = {
      errors: [{ message: 'Rate limit exceeded' }],
      data: { user: { login: 'octocat' } }
    };
    expect(() => validateGitHubResponse(json, 'octocat')).toThrowError(
      new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições à API do GitHub atingido.')
    );
  });

  it('should throw rate_limited (not not_found) when rate-limit error has no data field', () => {
    const json = { errors: [{ message: 'API rate limit exceeded for this resource.' }] };
    expect(() => validateGitHubResponse(json, 'octocat')).toThrowError(
      new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições à API do GitHub atingido.')
    );
  });
});

describe('StackOverflow Provider - validateStackOverflowResponse', () => {
  it('should not throw on valid response', () => {
    const json = { items: [{ display_name: 'StackUser' }] };
    expect(() => validateStackOverflowResponse(json, '123')).not.toThrow();
  });

  it('should throw "User Not Found" when items array is empty', () => {
    const json = { items: [] };
    expect(() => validateStackOverflowResponse(json, '999999')).toThrowError(
      new ProviderError('not_found', 'User Not Found', 'Stack Overflow user ID "999999" does not exist.')
    );
  });

  it('should throw "User Not Found" when items property is missing', () => {
    const json = {};
    expect(() => validateStackOverflowResponse(json, '999999')).toThrowError(
      new ProviderError('not_found', 'User Not Found', 'Stack Overflow user ID "999999" does not exist.')
    );
  });
});

describe('Twitch Provider - validateTwitchUserResponse', () => {
  it('should not throw on valid response', () => {
    const json = { data: [{ display_name: 'TwitchStreamer' }] };
    expect(() => validateTwitchUserResponse(json, 'streamer')).not.toThrow();
  });

  it('should throw "Channel Not Found" when data array is empty', () => {
    const json = { data: [] };
    expect(() => validateTwitchUserResponse(json, 'nonexistent')).toThrowError(
      new ProviderError('not_found', 'Channel Not Found', 'Twitch channel "nonexistent" does not exist.')
    );
  });

  it('should throw "Channel Not Found" when data property is missing', () => {
    const json = {};
    expect(() => validateTwitchUserResponse(json, 'nonexistent')).toThrowError(
      new ProviderError('not_found', 'Channel Not Found', 'Twitch channel "nonexistent" does not exist.')
    );
  });
});

describe('Validadores - nenhum texto de upstream chega ao cartão', () => {
  // Regressão: os blocos !response.ok já eram genéricos, mas GraphQL responde
  // erro com HTTP 200 em errors[] e a Stack Exchange usa error_message no corpo.
  // Esses dois caminhos repassavam o texto cru do provider até o SVG público.

  it('não repassa mensagem de errors[] do GraphQL do GitHub', () => {
    const json = {
      errors: [{ type: 'INTERNAL', message: 'db-replica-07.gh.internal timed out' }],
      data: { user: { login: 'octocat' } },
    };
    try {
      validateGitHubResponse(json, 'octocat');
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).not.toContain('db-replica-07');
      expect((err as ProviderError).message).toBe('Serviço temporariamente indisponível.');
    }
  });

  it('não repassa mensagem de rate limit do GraphQL do GitHub', () => {
    const json = { errors: [{ message: 'API rate limit exceeded for user ID 12345.' }] };
    try {
      validateGitHubResponse(json, 'octocat');
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect((err as ProviderError).category).toBe('rate_limited');
      expect((err as ProviderError).message).not.toContain('12345');
    }
  });

  it('não repassa error_message da Stack Exchange, que pode ecoar a STACKAPPS_KEY', () => {
    const json = { error_id: 403, error_message: "key 'abc123secret' is not valid" };
    try {
      validateStackOverflowResponse(json, '1');
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).not.toContain('abc123secret');
      expect((err as ProviderError).message).not.toContain('key');
    }
  });

  it('preserva a classificação de rate limit da Stack Exchange sem o texto cru', () => {
    const json = { error_id: 502, error_message: 'Violation of throttle for key xyz' };
    try {
      validateStackOverflowResponse(json, '1');
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect((err as ProviderError).category).toBe('rate_limited');
      expect((err as ProviderError).message).not.toContain('xyz');
    }
  });
});
