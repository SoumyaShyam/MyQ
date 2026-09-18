import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthError, ErrorCode } from '../shared/errors';
import type { Principal } from '../shared/types';
import type { StorageEngine } from '../storage/StorageEngine';

interface UserRecord { username: string; passwordHash: string; role: 'ADMIN' | 'USER'; createdAt: string; }

export class AuthService {
  public constructor(private readonly storage: StorageEngine, private readonly secret: string, private readonly ttlSeconds: number, private readonly rounds: number) {}
  public async ensureAdmin(username = 'admin', password = 'admin'): Promise<void> { if (!(await this.storage.get(this.key(username)))) await this.createUser(username, password, 'ADMIN'); }
  public async createUser(username: string, password: string, role: 'ADMIN' | 'USER' = 'USER'): Promise<void> { if (await this.storage.get(this.key(username))) throw new AuthError(ErrorCode.ALREADY_EXISTS, `User ${username} already exists`); const record: UserRecord = { username, passwordHash: await bcrypt.hash(password, this.rounds), role, createdAt: new Date().toISOString() }; await this.storage.put(this.key(username), Buffer.from(JSON.stringify(record))); }
  public async alterPassword(username: string, password: string): Promise<void> { const record = await this.user(username); record.passwordHash = await bcrypt.hash(password, this.rounds); await this.storage.put(this.key(username), Buffer.from(JSON.stringify(record))); }
  public async dropUser(username: string): Promise<void> { await this.user(username); await this.storage.delete(this.key(username)); }
  public async login(username: string, password: string): Promise<{ token: string; principal: Principal }> { const record = await this.user(username); if (!(await bcrypt.compare(password, record.passwordHash))) throw new AuthError(ErrorCode.AUTH_INVALID, 'Invalid credentials'); const now = Math.floor(Date.now() / 1000); const principal: Principal = { subject: username, username, role: record.role, issuedAt: now, expiresAt: now + this.ttlSeconds }; const token = jwt.sign(principal, this.secret, { expiresIn: this.ttlSeconds }); return { token, principal }; }
  public verify(token: string): Principal { try { return jwt.verify(token, this.secret) as Principal; } catch (error) { throw new AuthError(ErrorCode.AUTH_INVALID, 'Invalid or expired token', false, error); } }
  private async user(username: string): Promise<UserRecord> { const value = await this.storage.get(this.key(username)); if (!value) throw new AuthError(ErrorCode.AUTH_INVALID, 'Invalid credentials'); return JSON.parse(value.toString('utf8')) as UserRecord; }
  private key(username: string): string { return `meta/user/${username}`; }
}
