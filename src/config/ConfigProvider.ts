import convict from 'convict';

export interface MyQConfig {
  server: { host: string; port: number; maxFrameBytes: number };
  storage: { dataDir: string };
  wal: { walDir: string };
  auth: { jwtSecret: string; jwtTtlSeconds: number; bcryptRounds: number };
}

export class ConfigProvider {
  public static load(environment: NodeJS.ProcessEnv = process.env): MyQConfig {
    const config = convict({
      server: { host: { format: String, default: '127.0.0.1', env: 'MYQ_HOST' }, port: { format: 'port', default: 3306, env: 'MYQ_PORT' }, maxFrameBytes: { format: Number, default: 1024 * 1024, env: 'MYQ_MAX_FRAME_BYTES' } },
      storage: { dataDir: { format: String, default: './data', env: 'MYQ_DATA_DIR' } },
      wal: { walDir: { format: String, default: './data/wal', env: 'MYQ_WAL_DIR' } },
      auth: { jwtSecret: { format: String, default: 'development-only-secret', env: 'MYQ_JWT_SECRET' }, jwtTtlSeconds: { format: Number, default: 3600, env: 'MYQ_JWT_TTL_SECONDS' }, bcryptRounds: { format: Number, default: 10, env: 'MYQ_BCRYPT_ROUNDS' } },
    });
    config.load({
      server: { host: environment.MYQ_HOST ?? '127.0.0.1', port: Number(environment.MYQ_PORT ?? 3306), maxFrameBytes: Number(environment.MYQ_MAX_FRAME_BYTES ?? 1024 * 1024) },
      storage: { dataDir: environment.MYQ_DATA_DIR ?? './data' },
      wal: { walDir: environment.MYQ_WAL_DIR ?? './data/wal' },
      auth: { jwtSecret: environment.MYQ_JWT_SECRET ?? 'development-only-secret', jwtTtlSeconds: Number(environment.MYQ_JWT_TTL_SECONDS ?? 3600), bcryptRounds: Number(environment.MYQ_BCRYPT_ROUNDS ?? 10) },
    });
    config.validate({ allowed: 'strict' });
    return config.getProperties() as MyQConfig;
  }
}
