export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '>' | '<' | '>=' | '<=' | '==' | '!='

export type ASTNode =
  | { type: 'Number'; value: number }
  | { type: 'String'; value: string }
  | { type: 'Identifier'; name: string }
  | { type: 'Unary'; op: '-' | 'NOT'; argument: ASTNode }
  | { type: 'Binary'; op: BinaryOp; left: ASTNode; right: ASTNode }
  | { type: 'Logical'; op: 'AND' | 'OR'; left: ASTNode; right: ASTNode }
  | { type: 'Call'; name: string; args: ASTNode[] }
