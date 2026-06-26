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

  it('should throw "User Not Found" when data/user is missing', () => {
    const json = {};
    expect(() => validateGitHubResponse(json, 'invalid-user')).toThrowError(
      new ProviderError('not_found', 'User Not Found', 'GitHub user "invalid-user" does not exist.')
    );
  });

  it('should throw "GitHub API Error" when GraphQL errors are present', () => {
    const json = {
      errors: [{ message: 'Rate limit exceeded' }],
      data: { user: { login: 'octocat' } }
    };
    expect(() => validateGitHubResponse(json, 'octocat')).toThrowError(
      new ProviderError('rate_limited', 'GitHub API Error', 'Rate limit exceeded')
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
