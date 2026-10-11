import 'server-only'
import { randomInt } from 'node:crypto'

// Alphabet lisible : sans 0, O, 1, l, I et sans symboles.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const ALL = UPPER + LOWER + DIGITS

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72

function pick(set: string): string {
  return set[randomInt(set.length)]
}

/** Mot de passe de 12 caractères, tirage cryptographique, au moins une majuscule, une minuscule et un chiffre. */
export function generatePassword(length = 12): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)]
  while (chars.length < length) chars.push(pick(ALL))
  // Mélange de Fisher-Yates avec tirage sécurisé.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function validPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX && p.trim() === p
}
