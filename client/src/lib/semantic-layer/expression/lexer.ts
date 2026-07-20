import { LexError } from './errors'

export type TokenType =
  | 'number'
  | 'string'
  | 'ident'
  | 'punct'
  | 'eof'

export interface Token {
  type: TokenType
  value: string
  pos: number
}

const PUNCT_2 = ['>=', '<=', '==', '!=']
const PUNCT_1 = ['+', '-', '*', '/', '%', '(', ')', ',']
const SINGLE_COMPARE = ['>', '<']

function isDigit(ch: string) {
  return ch >= '0' && ch <= '9'
}

function isIdentStart(ch: string) {
  return /[a-zA-Z_]/.test(ch)
}

function isIdentPart(ch: string) {
  return /[a-zA-Z0-9_.]/.test(ch)
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = source.length

  while (i < n) {
    const ch = source[i]

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1] ?? ''))) {
      const start = i
      while (i < n && isDigit(source[i])) i++
      if (source[i] === '.') {
        i++
        while (i < n && isDigit(source[i])) i++
      }
      tokens.push({ type: 'number', value: source.slice(start, i), pos: start })
      continue
    }

    if (ch === "'" || ch === '"') {
      const quote = ch
      const start = i
      i++
      let value = ''
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\' && source[i + 1] === quote) {
          value += quote
          i += 2
          continue
        }
        value += source[i]
        i++
      }
      if (i >= n) throw new LexError(`Cadena sin cerrar`, start)
      i++
      tokens.push({ type: 'string', value, pos: start })
      continue
    }

    if (ch === '[') {
      const start = i
      i++
      let value = ''
      while (i < n && source[i] !== ']') {
        value += source[i]
        i++
      }
      if (i >= n) throw new LexError('Identificador entre [] sin cerrar', start)
      i++
      tokens.push({ type: 'ident', value: value.trim(), pos: start })
      continue
    }

    if (isIdentStart(ch)) {
      const start = i
      while (i < n && isIdentPart(source[i])) i++
      tokens.push({ type: 'ident', value: source.slice(start, i), pos: start })
      continue
    }

    const two = source.slice(i, i + 2)
    if (PUNCT_2.includes(two)) {
      tokens.push({ type: 'punct', value: two, pos: i })
      i += 2
      continue
    }

    if (PUNCT_1.includes(ch) || SINGLE_COMPARE.includes(ch)) {
      tokens.push({ type: 'punct', value: ch, pos: i })
      i++
      continue
    }

    throw new LexError(`Caracter inesperado "${ch}"`, i)
  }

  tokens.push({ type: 'eof', value: '', pos: n })
  return tokens
}
