import type { SqlValue } from '../shared/types';

export interface SourceSpan { start: number; end: number; line: number; column: number; }
export interface AstNode { span: SourceSpan; }
export interface IdentifierNode extends AstNode { kind: 'identifier'; name: string; }
export interface LiteralNode extends AstNode { kind: 'literal'; value: SqlValue; }
export interface ColumnReferenceNode extends AstNode { kind: 'column'; name: string; }
export interface BinaryExpressionNode extends AstNode { kind: 'binary'; operator: '=' | '<>' | '<' | '<=' | '>' | '>=' | 'AND' | 'OR'; left: ExpressionNode; right: ExpressionNode; }
export type ExpressionNode = LiteralNode | ColumnReferenceNode | BinaryExpressionNode;
export interface WhereClauseNode extends AstNode { expression: ExpressionNode; }
export interface OrderByNode extends AstNode { column: string; direction: 'ASC' | 'DESC'; }
export interface ColumnDefinitionNode extends AstNode { name: string; dataType: 'INT' | 'VARCHAR' | 'BOOLEAN' | 'TIMESTAMP'; length?: number; primaryKey: boolean; unique: boolean; nullable: boolean; }

export type StatementNode = CreateDatabaseNode | CreateTableNode | DropTableNode | InsertNode | UpdateNode | DeleteNode | SelectNode | CreateUserNode | AlterUserNode | DropUserNode;
export interface CreateDatabaseNode extends AstNode { kind: 'createDatabase'; database: string; ifNotExists: boolean; }
export interface CreateTableNode extends AstNode { kind: 'createTable'; table: string; columns: ColumnDefinitionNode[]; ifNotExists: boolean; }
export interface DropTableNode extends AstNode { kind: 'dropTable'; table: string; ifExists: boolean; }
export interface InsertNode extends AstNode { kind: 'insert'; table: string; columns?: string[]; values: LiteralNode[][]; }
export interface AssignmentNode extends AstNode { kind: 'assignment'; column: string; value: ExpressionNode; }
export interface UpdateNode extends AstNode { kind: 'update'; table: string; assignments: AssignmentNode[]; where?: WhereClauseNode; }
export interface DeleteNode extends AstNode { kind: 'delete'; table: string; where?: WhereClauseNode; }
export interface SelectNode extends AstNode { kind: 'select'; table: string; columns: string[]; where?: WhereClauseNode; orderBy?: OrderByNode; limit?: number; }
export interface CreateUserNode extends AstNode { kind: 'createUser'; username: string; password: string; }
export interface AlterUserNode extends AstNode { kind: 'alterUser'; username: string; password: string; }
export interface DropUserNode extends AstNode { kind: 'dropUser'; username: string; }
