import type { ASTNode, BinaryOp } from './ast'
import { ParseError } from './errors'
import { tokenize, type Token } from './lexer'

const KEYWORDS = new Set(['AND', 'OR', 'NOT'])

class Parser {
  private pos = 0

  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private next(): Token {
    return this.tokens[this.pos++]
  }

  private isKeyword(token: Token, keyword: string): boolean {
    return token.type === 'ident' && token.value.toUpperCase() === keyword
  }

  private isPunct(token: Token, value: string): boolean {
    return token.type === 'punct' && token.value === value
  }

  private expectPunct(value: string) {
    const token = this.next()
    if (!this.isPunct(token, value)) {
      throw new ParseError(`Se esperaba "${value}"`, token.pos)
    }
  }

  parseExpression(): ASTNode {
    const node = this.parseOr()
    if (this.peek().type !== 'eof') {
      throw new ParseError(`Token inesperado "${this.peek().value}"`, this.peek().pos)
    }
    return node
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd()
    while (this.isKeyword(this.peek(), 'OR')) {
      this.next()
      const right = this.parseAnd()
      left = { type: 'Logical', op: 'OR', left, right }
    }
    return left
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality()
    while (this.isKeyword(this.peek(), 'AND')) {
      this.next()
      const right = this.parseEquality()
      left = { type: 'Logical', op: 'AND', left, right }
    }
    return left
  }

  private parseEquality(): ASTNode {
    let left = this.parseRelational()
    while (this.isPunct(this.peek(), '==') || this.isPunct(this.peek(), '!=')) {
      const op = this.next().value as BinaryOp
      const right = this.parseRelational()
      left = { type: 'Binary', op, left, right }
    }
    return left
  }

  private parseRelational(): ASTNode {
    let left = this.parseAdditive()
    while (
      this.isPunct(this.peek(), '>') ||
      this.isPunct(this.peek(), '<') ||
      this.isPunct(this.peek(), '>=') ||
      this.isPunct(this.peek(), '<=')
    ) {
      const op = this.next().value as BinaryOp
      const right = this.parseAdditive()
      left = { type: 'Binary', op, left, right }
    }
    return left
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative()
    while (this.isPunct(this.peek(), '+') || this.isPunct(this.peek(), '-')) {
      const op = this.next().value as BinaryOp
      const right = this.parseMultiplicative()
      left = { type: 'Binary', op, left, right }
    }
    return left
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary()
    while (
      this.isPunct(this.peek(), '*') ||
      this.isPunct(this.peek(), '/') ||
      this.isPunct(this.peek(), '%')
    ) {
      const op = this.next().value as BinaryOp
      const right = this.parseUnary()
      left = { type: 'Binary', op, left, right }
    }
    return left
  }

  private parseUnary(): ASTNode {
    if (this.isPunct(this.peek(), '-')) {
      this.next()
      return { type: 'Unary', op: '-', argument: this.parseUnary() }
    }
    if (this.isKeyword(this.peek(), 'NOT')) {
      this.next()
      return { type: 'Unary', op: 'NOT', argument: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): ASTNode {
    const token = this.peek()

    if (token.type === 'number') {
      this.next()
      return { type: 'Number', value: Number(token.value) }
    }

    if (token.type === 'string') {
      this.next()
      return { type: 'String', value: token.value }
    }

    if (this.isPunct(token, '(')) {
      this.next()
      const node = this.parseOr()
      this.expectPunct(')')
      return node
    }

    if (token.type === 'ident') {
      if (KEYWORDS.has(token.value.toUpperCase())) {
        throw new ParseError(`Uso inesperado de "${token.value}"`, token.pos)
      }
      this.next()
      if (this.isPunct(this.peek(), '(')) {
        this.next()
        const args: ASTNode[] = []
        if (!this.isPunct(this.peek(), ')')) {
          args.push(this.parseOr())
          while (this.isPunct(this.peek(), ',')) {
            this.next()
            args.push(this.parseOr())
          }
        }
        this.expectPunct(')')
        return { type: 'Call', name: token.value.toUpperCase(), args }
      }
      return { type: 'Identifier', name: token.value }
    }

    throw new ParseError(`Token inesperado "${token.value || 'EOF'}"`, token.pos)
  }
}

export function parseExpression(source: string): ASTNode {
  const tokens = tokenize(source)
  return new Parser(tokens).parseExpression()
}
