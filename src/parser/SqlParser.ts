import { ErrorCode, ParserError } from '../shared/errors';
import type { SqlValue } from '../shared/types';
import type {
  AssignmentNode, BinaryExpressionNode, ColumnDefinitionNode, ColumnReferenceNode, CreateDatabaseNode, CreateTableNode,
  DeleteNode, DropTableNode, ExpressionNode, InsertNode, LiteralNode, SelectNode, StatementNode, UpdateNode, WhereClauseNode,
  CreateUserNode, AlterUserNode, DropUserNode,
} from './ast';

interface Token { value: string; upper: string; start: number; end: number; }

export class SqlParser {
  public parse(sql: string): StatementNode {
    const tokens = tokenize(sql);
    const parser = new Parser(tokens, sql);
    return parser.parseStatement();
  }
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < sql.length) {
    const character = sql[index];
    if (character === undefined) break;
    if (/\s/.test(character)) { index += 1; continue; }
    if (character === "'") {
      const start = index++;
      let value = '';
      while (index < sql.length) {
        const current = sql[index++];
        if (current === undefined) break;
        if (current === "'" && sql[index - 2] !== '\\') break;
        if (current === '\\' && sql[index] === "'") { value += "'"; index += 1; } else value += current;
      }
      if (sql[index - 1] !== "'") throw new ParserError(ErrorCode.PARSE_SYNTAX, 'Unterminated string literal');
      tokens.push({ value: `'${value}'`, upper: `'${value}'`, start, end: index });
      continue;
    }
    if (character === '`') {
      const start = index++;
      const end = sql.indexOf('`', index);
      if (end < 0) throw new ParserError(ErrorCode.PARSE_SYNTAX, 'Unterminated identifier');
      const value = sql.slice(index, end); index = end + 1;
      tokens.push({ value, upper: value.toUpperCase(), start, end: index }); continue;
    }
    const two = sql.slice(index, index + 2);
    if (['<>', '<=', '>='].includes(two)) { tokens.push({ value: two, upper: two, start: index, end: index + 2 }); index += 2; continue; }
    if ('(),;*=<>'.includes(character)) { tokens.push({ value: character, upper: character, start: index, end: index + 1 }); index += 1; continue; }
    const match = /^[A-Za-z_$][A-Za-z0-9_$]*|-?\d+(?:\.\d+)?/.exec(sql.slice(index));
    if (!match) throw new ParserError(ErrorCode.PARSE_SYNTAX, `Unexpected character at position ${index}`);
    const value = match[0]; tokens.push({ value, upper: value.toUpperCase(), start: index, end: index + value.length }); index += value.length;
  }
  return tokens;
}

class Parser {
  private position = 0;
  public constructor(private readonly tokens: Token[], private readonly sql: string) {}

  public parseStatement(): StatementNode {
    const keyword = this.peek().upper;
    let statement: StatementNode;
    if (keyword === 'CREATE') statement = this.parseCreate();
    else if (keyword === 'DROP') statement = this.parseDrop();
    else if (keyword === 'INSERT') statement = this.parseInsert();
    else if (keyword === 'UPDATE') statement = this.parseUpdate();
    else if (keyword === 'DELETE') statement = this.parseDelete();
    else if (keyword === 'SELECT') statement = this.parseSelect();
    else if (keyword === 'ALTER') statement = this.parseAlter(this.peek());
    else throw this.error(`Unsupported statement: ${keyword}`);
    if (this.peekOrUndefined()?.value === ';') this.consume();
    if (this.position < this.tokens.length) throw this.error(`Unexpected token ${this.peek().value}`);
    return statement;
  }

  private parseCreate(): StatementNode {
    const start = this.consume('CREATE');
    if (this.match('DATABASE')) { const database = this.identifier(); return { kind: 'createDatabase', database, ifNotExists: false, span: this.span(start) } satisfies CreateDatabaseNode; }
    if (this.match('TABLE')) return this.parseCreateTable(start);
    if (this.match('USER')) return this.parseCreateUser(start);
    throw this.error('Expected DATABASE, TABLE, or USER after CREATE');
  }

  private parseCreateTable(start: Token): CreateTableNode {
    const table = this.identifier(); this.consume('('); const columns: ColumnDefinitionNode[] = [];
    do { const columnStart = this.peek(); const name = this.identifier(); const type = this.parseType(); let primaryKey = false; let unique = false; let nullable = true;
      while (!this.is(')') && !this.is(',')) { if (this.match('PRIMARY')) { this.consume('KEY'); primaryKey = true; nullable = false; } else if (this.match('UNIQUE')) unique = true; else if (this.match('NOT')) { this.consume('NULL'); nullable = false; } else throw this.error('Unsupported column constraint'); }
      columns.push({ name, dataType: type.dataType, length: type.length, primaryKey, unique, nullable, span: this.span(columnStart) });
    } while (this.match(','));
    this.consume(')'); return { kind: 'createTable', table, columns, ifNotExists: false, span: this.span(start) };
  }

  private parseType(): { dataType: ColumnDefinitionNode['dataType']; length?: number } {
    if (this.match('INT')) return { dataType: 'INT' };
    if (this.match('BOOLEAN')) return { dataType: 'BOOLEAN' };
    if (this.match('TIMESTAMP')) return { dataType: 'TIMESTAMP' };
    if (this.match('VARCHAR')) { this.consume('('); const length = Number(this.consume().value); this.consume(')'); return { dataType: 'VARCHAR', length }; }
    throw this.error('Expected a supported data type');
  }

  private parseDrop(): StatementNode { const start = this.consume('DROP'); if (this.match('TABLE')) return { kind: 'dropTable', table: this.identifier(), ifExists: false, span: this.span(start) } satisfies DropTableNode; if (this.match('USER')) return { kind: 'dropUser', username: this.literalString(), span: this.span(start) } satisfies DropUserNode; throw this.error('Expected TABLE or USER after DROP'); }

  private parseInsert(): InsertNode { const start = this.consume('INSERT'); this.consume('INTO'); const table = this.identifier(); let columns: string[] | undefined; if (this.match('(')) { columns = this.identifierList(); this.consume(')'); } this.consume('VALUES'); const values: LiteralNode[][] = []; do { this.consume('('); const row: LiteralNode[] = []; do row.push(this.literal()); while (this.match(',')); this.consume(')'); values.push(row); } while (this.match(',')); return { kind: 'insert', table, columns, values, span: this.span(start) }; }

  private parseUpdate(): UpdateNode { const start = this.consume('UPDATE'); const table = this.identifier(); this.consume('SET'); const assignments: AssignmentNode[] = []; do { const assignmentStart = this.peek(); const column = this.identifier(); this.consume('='); assignments.push({ kind: 'assignment', column, value: this.expression(), span: this.span(assignmentStart) }); } while (this.match(',')); const where = this.parseWhere(); return { kind: 'update', table, assignments, where, span: this.span(start) }; }
  private parseDelete(): DeleteNode { const start = this.consume('DELETE'); this.consume('FROM'); const table = this.identifier(); return { kind: 'delete', table, where: this.parseWhere(), span: this.span(start) }; }
  private parseSelect(): SelectNode { const start = this.consume('SELECT'); const columns = this.match('*') ? ['*'] : this.identifierList(); this.consume('FROM'); const table = this.identifier(); const where = this.parseWhere(); let orderBy; if (this.match('ORDER')) { const orderStart = this.consume('BY'); const column = this.identifier(); const direction: 'ASC' | 'DESC' = this.match('DESC') ? 'DESC' : 'ASC'; orderBy = { column, direction, span: this.span(orderStart) }; } let limit; if (this.match('LIMIT')) limit = Number(this.consume().value); return { kind: 'select', table, columns, where, orderBy, limit, span: this.span(start) }; }
  private parseCreateUser(start: Token): CreateUserNode { const username = this.literalString(); this.consume('IDENTIFIED'); this.consume('BY'); return { kind: 'createUser', username, password: this.literalString(), span: this.span(start) }; }
  private parseAlter(start: Token): AlterUserNode { this.consume('USER'); const username = this.literalString(); this.consume('IDENTIFIED'); this.consume('BY'); return { kind: 'alterUser', username, password: this.literalString(), span: this.span(start) }; }
  private parseWhere(): WhereClauseNode | undefined { if (!this.match('WHERE')) return undefined; const token = this.tokens[this.position - 1] ?? this.peek(); return { expression: this.expression(), span: this.span(token) }; }
  private expression(): ExpressionNode { let left = this.operand(); while (this.peekOrUndefined() && ['=', '<>', '<', '<=', '>', '>=', 'AND', 'OR'].includes(this.peek().upper)) { const token = this.consume(); const right = this.operand(); left = { kind: 'binary', operator: token.upper as BinaryExpressionNode['operator'], left, right, span: this.span(token) }; } return left; }
  private operand(): ExpressionNode { const token = this.peek(); if (token.value === "'" || token.value.startsWith("'")) return this.literal(); if (/^-?\d/.test(token.value) || ['NULL', 'TRUE', 'FALSE'].includes(token.upper)) return this.literal(); return { kind: 'column', name: this.identifier(), span: this.span(token) } satisfies ColumnReferenceNode; }
  private literal(): LiteralNode { const token = this.consume(); let value: SqlValue; if (token.upper === 'NULL') value = null; else if (token.upper === 'TRUE') value = true; else if (token.upper === 'FALSE') value = false; else if (token.value.startsWith("'")) value = token.value.slice(1, -1); else value = Number(token.value); return { kind: 'literal', value, span: this.span(token) }; }
  private literalString(): string { const token = this.consume(); if (!token.value.startsWith("'")) throw this.error('Expected a quoted string'); return token.value.slice(1, -1); }
  private identifierList(): string[] { const values = [this.identifier()]; while (this.match(',')) values.push(this.identifier()); return values; }
  private identifier(): string { const token = this.consume(); if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token.value)) throw this.error(`Expected identifier, got ${token.value}`); return token.value; }
  private consume(expected?: string): Token { const token = this.peek(); if (expected && token.upper !== expected && token.value !== expected) throw this.error(`Expected ${expected}, got ${token.value}`); this.position += 1; return token; }
  private match(value: string): boolean { if (this.peekOrUndefined()?.upper === value || this.peekOrUndefined()?.value === value) { this.position += 1; return true; } return false; }
  private is(value: string): boolean { return this.peekOrUndefined()?.value === value || this.peekOrUndefined()?.upper === value; }
  private peek(): Token { const token = this.peekOrUndefined(); if (!token) throw this.error('Unexpected end of statement'); return token; }
  private peekOrUndefined(): Token | undefined { return this.tokens[this.position]; }
  private span(token: Token): { start: number; end: number; line: number; column: number } { const before = this.sql.slice(0, token.start); const lines = before.split('\n'); return { start: token.start, end: token.end, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 }; }
  private error(message: string): ParserError { return new ParserError(ErrorCode.PARSE_SYNTAX, message); }
}
