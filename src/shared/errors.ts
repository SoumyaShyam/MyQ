export enum ErrorCode {
  PARSE_SYNTAX = 'PARSE_SYNTAX',
  UNSUPPORTED = 'UNSUPPORTED',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PRIMARY_KEY_CONFLICT = 'PRIMARY_KEY_CONFLICT',
  UNIQUE_CONFLICT = 'UNIQUE_CONFLICT',
  NOT_NULL = 'NOT_NULL',
  STORAGE = 'STORAGE',
  WAL = 'WAL',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  FORBIDDEN = 'FORBIDDEN',
  PROTOCOL = 'PROTOCOL',
  INTERNAL = 'INTERNAL',
}

export class MyQError extends Error {
  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MyQError';
  }
}

export class ParserError extends MyQError {}
export class StorageError extends MyQError {}
export class WalError extends MyQError {}
export class AuthError extends MyQError {}
export class ProtocolError extends MyQError {}
