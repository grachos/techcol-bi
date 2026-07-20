export class ExpressionError extends Error {
  constructor(
    message: string,
    public readonly position?: number
  ) {
    super(message)
    this.name = 'ExpressionError'
  }
}

export class LexError extends ExpressionError {}
export class ParseError extends ExpressionError {}
export class EvalError extends ExpressionError {}
