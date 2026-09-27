import { describe, expect, it } from 'vitest';
import { JAMO_CHARACTERS, digitToJamo, jamoToDigit } from '../constants';

describe('jamo mapping', () => {
  it('maps digits 1-9 to jamo and back', () => {
    JAMO_CHARACTERS.forEach((jamo, index) => {
      expect(digitToJamo(index + 1)).toBe(jamo);
      expect(jamoToDigit(jamo)).toBe(index + 1);
    });
  });

  it('treats 0 and unknown characters as empty', () => {
    expect(digitToJamo(0)).toBe('');
    expect(jamoToDigit('ㅊ')).toBe(0);
    expect(jamoToDigit('')).toBe(0);
  });
});
