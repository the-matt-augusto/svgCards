import { describe, it, expect } from 'vitest';
import { safeHex } from '../api/core';

describe('safeHex', () => {
  it('should accept valid 3-digit hex colors', () => {
    expect(safeHex('fff')).toBe(true);
    expect(safeHex('000')).toBe(true);
    expect(safeHex('abc')).toBe(true);
    expect(safeHex('ABC')).toBe(true);
  });

  it('should accept valid 6-digit hex colors', () => {
    expect(safeHex('ffffff')).toBe(true);
    expect(safeHex('000000')).toBe(true);
    expect(safeHex('12a3f6')).toBe(true);
    expect(safeHex('12A3F6')).toBe(true);
  });

  it('should reject color names', () => {
    expect(safeHex('red')).toBe(false);
    expect(safeHex('blue')).toBe(false);
    expect(safeHex('green')).toBe(false);
  });

  it('should reject empty strings, null, or undefined', () => {
    expect(safeHex('')).toBe(false);
    expect(safeHex(null as any)).toBe(false);
    expect(safeHex(undefined as any)).toBe(false);
  });

  it('should reject 7-digit hex strings', () => {
    expect(safeHex('1234567')).toBe(false);
    expect(safeHex('ffffff0')).toBe(false);
  });

  it('should reject injection attempts', () => {
    expect(safeHex('"/><script>')).toBe(false);
    expect(safeHex('<script>alert(1)</script>')).toBe(false);
    expect(safeHex('eval("1")')).toBe(false);
  });
});
