import { ErrorCode } from '../src/shared/errors';
import { ParserError } from '../src/shared/errors';
import { SqlParser } from '../src/parser/SqlParser';

describe('SqlParser', () => {
  const parser = new SqlParser();
  test('parses the documented CRUD statements', () => {
    expect(parser.parse('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE);').kind).toBe('createTable');
    expect(parser.parse("INSERT INTO users VALUES (1, 'Soumya', 's@example.com');").kind).toBe('insert');
    expect(parser.parse("SELECT * FROM users WHERE id = 1 ORDER BY id DESC LIMIT 2")).toMatchObject({ kind: 'select', table: 'users', limit: 2 });
    expect(parser.parse("UPDATE users SET name = 'Roy' WHERE id = 1").kind).toBe('update');
    expect(parser.parse('DELETE FROM users WHERE id = 1').kind).toBe('delete');
  });
  test('returns a typed syntax error', () => {
    try { parser.parse('SELECT FROM'); } catch (error) { expect(error).toBeInstanceOf(ParserError); expect((error as ParserError).code).toBe(ErrorCode.PARSE_SYNTAX); return; }
    throw new Error('Expected parser error');
  });
});
