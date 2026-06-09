import { randomInt } from 'crypto';

export function generate4DigitCode(): string {
  return String(randomInt(1000, 9999)).padStart(4, '0');
}
