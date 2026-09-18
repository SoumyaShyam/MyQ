# MyQ Database Server

MyQ is a TypeScript database server inspired by MySQL. Phase 1 provides a small but real database engine with SQL parsing, durable storage, primary and unique indexes, write-ahead logging, authentication, and a framed native TCP protocol.

The complete architecture and implementation specification is in [documentation.md](documentation.md).

## Table of contents

- [Current status](#current-status)
- [Requirements](#requirements)
- [Install and run](#install-and-run)
- [Use the server](#use-the-server)
- [Configuration](#configuration)
- [SQL examples](#sql-examples)
- [TCP protocol](#tcp-protocol)
- [Project commands](#project-commands)
- [Data safety](#data-safety)
- [Development layout](#development-layout)
- [Roadmap](#roadmap)

## Current status

Implemented in this repository:

- TypeScript project setup with strict type checking and Jest.
- SQL parser and typed AST for database/table DDL, CRUD, filtering, ordering, limits, and user administration.
- Persistent file-backed storage with the `StorageEngine` contract and `RocksDbStorageEngine` adapter boundary.
- Ordered B+ tree index API with primary and unique constraint enforcement.
- Append-only framed WAL with LSNs, checksums, commit records, legacy migration, and startup replay.
- Serialized mutation execution with preflight validation for multi-row inserts and typed column checks.
- bcrypt password hashing and JWT authentication.
- Native TCP server with length-prefixed JSON frames.
- Focused parser, storage, index, WAL, and protocol tests.

The current implementation is the `0.3.2` Phase 1 development baseline. The file-backed storage adapter keeps local setup portable; the storage interface is the replacement point for a production RocksDB binding. Replication, sharding, MVCC, caching, clustering, optimizer work, metrics, and MySQL wire compatibility are not implemented.

The security maintenance release upgrades bcrypt to `6.0.0`, removing the vulnerable `@mapbox/node-pre-gyp` and `tar` dependency chain. npm install scripts are explicitly approved only for the pinned native packages `bcrypt@6.0.0` and `esbuild@0.28.2`; these scripts are required to install their platform binaries.

## Requirements

- Node.js 20 or newer.
- npm 10 or newer.
- Windows, macOS, or Linux.

## Install and run

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

PowerShell execution policy may block the `npm` shim on Windows. Use `npm.cmd` as shown above, or run the commands from a shell where npm scripts are enabled.

For development, `npm.cmd run dev` starts the TypeScript entrypoint directly. For a normal deployment, build once with `npm.cmd run build`, then start the compiled server with `npm.cmd start`.

The server listens on `127.0.0.1:3306` by default. It creates `data/store.json` and `data/wal/wal.jsonl` on first start. The development administrator is:

```text
username: admin
password: admin
```

Change this credential before using MyQ outside local development. Set `MYQ_JWT_SECRET` to a strong secret in every non-development environment.

## Use the server

Follow these steps from a fresh checkout:

1. Install dependencies:

	```powershell
	npm.cmd install
	```

2. Create the local configuration file:

	```powershell
	Copy-Item .env.example .env
	```

	Edit `.env` before production use. The server loads `.env` automatically at startup. At minimum, replace `MYQ_JWT_SECRET` and the default administrator password workflow.

3. Check the installation:

	```powershell
	npm.cmd run typecheck
	npm.cmd test
	npm.cmd run build
	```

4. Start the server in one terminal:

	```powershell
	npm.cmd start
	```

	Keep this terminal running. The server opens storage and replays the WAL before it accepts TCP connections.

5. In a second terminal, execute a query with the included client:

	```powershell
	npm.cmd run client -- "SELECT * FROM users"
	```

	The client logs in as `admin` using `MYQ_USER` and `MYQ_PASSWORD` when supplied, then sends the SQL query to `MYQ_DATABASE`.

6. To use a different server address or credentials:

	```powershell
	$env:MYQ_HOST = '127.0.0.1'
	$env:MYQ_PORT = '3306'
	$env:MYQ_USER = 'admin'
	$env:MYQ_PASSWORD = 'admin'
	$env:MYQ_DATABASE = 'app'
	npm.cmd run client -- "SELECT * FROM users WHERE id = 1"
	```

7. Stop the server with `Ctrl+C`. MyQ stops accepting connections, closes the WAL, and flushes the storage file.

### First database setup

The client sends one query per invocation. Create the database and table by running the server, then use a small Node.js script or a TCP client that sends these statements in sequence:

```sql
CREATE DATABASE app;
CREATE TABLE users (
	 id INT PRIMARY KEY,
	 name VARCHAR(255) NOT NULL,
	 email VARCHAR(255) UNIQUE
);
INSERT INTO users VALUES (1, 'Soumya', 's@example.com');
```

The included client is intentionally one-query-per-process. For an interactive workflow, use the protocol from [TCP protocol](#tcp-protocol) or build a client around `src/network/FrameCodec.ts`.

## Configuration

Copy `.env.example` to `.env` and set values for your environment. The application reads these environment variables:

| Variable | Default | Purpose |
|---|---:|---|
| `MYQ_HOST` | `127.0.0.1` | TCP bind address |
| `MYQ_PORT` | `3306` | TCP port |
| `MYQ_DATA_DIR` | `./data` | Durable data directory |
| `MYQ_WAL_DIR` | `./data/wal` | WAL directory |
| `MYQ_JWT_SECRET` | development-only value | JWT signing secret |
| `MYQ_JWT_TTL_SECONDS` | `3600` | Token lifetime |
| `MYQ_BCRYPT_ROUNDS` | `10` | Password hashing cost |
| `MYQ_MAX_FRAME_BYTES` | `1048576` | Maximum protocol frame |

Convict validates the configuration at startup. Keep the database and WAL directories on durable storage and do not run two MyQ processes against the same data directory.

## SQL examples

MyQ uses the database name supplied in each protocol query. A minimal session creates a database and table, inserts a row, reads it, updates it, and deletes it:

```sql
CREATE DATABASE app;
CREATE TABLE users (
	id INT PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	email VARCHAR(255) UNIQUE
);
INSERT INTO users VALUES (1, 'Soumya', 's@example.com');
SELECT * FROM users;
SELECT id, name FROM users WHERE id = 1 ORDER BY id ASC LIMIT 10;
UPDATE users SET name = 'Roy' WHERE id = 1;
DELETE FROM users WHERE id = 1;
```

Phase 1 supports `INT`, `VARCHAR(n)`, `BOOLEAN`, and `TIMESTAMP` declarations. Every table requires a primary key. Unique and not-null constraints are enforced during inserts and updates.

## TCP protocol

MyQ does not use HTTP. Each TCP frame is:

```text
4 bytes: ASCII magic `MYQ1`
1 byte: protocol version (`1`)
1 byte: flags
4 bytes: unsigned big-endian JSON payload length
N bytes: UTF-8 JSON payload
4 bytes: SHA-256-derived payload checksum
```

Login request:

```json
{"type":"LOGIN","requestId":"r1","username":"admin","password":"admin"}
```

Login response:

```json
{"type":"LOGIN_OK","requestId":"r1","token":"...","expiresAt":0}
```

Query request:

```json
{"type":"QUERY","requestId":"r2","token":"...","database":"app","sql":"SELECT * FROM users"}
```

Query response:

```json
{"type":"QUERY_OK","requestId":"r2","result":{"columns":["id","name","email"],"rows":[{"id":1,"name":"Soumya","email":"s@example.com"}]}}
```

The repository includes `npm.cmd run client -- "SQL"` for one-query requests. For another client, send the complete `MYQ1` frame described above, including its checksum; a plain 4-byte length prefix is not sufficient. The server also accepts `PING` frames and returns `PONG`.

## Project commands

| Command | Description |
|---|---|
| `npm.cmd run dev` | Run TypeScript directly with `tsx` |
| `npm.cmd run build` | Emit JavaScript into `dist/` |
| `npm.cmd start` | Run the compiled server |
| `npm.cmd run typecheck` | Run strict TypeScript validation |
| `npm.cmd test` | Run Jest tests serially |
| `npm.cmd run test:watch` | Run Jest in watch mode |
| `npm.cmd run client -- "SQL"` | Login and execute one SQL query |

## Data safety

The WAL is appended before row and index changes. On startup, MyQ opens storage, verifies WAL frame lengths and checksums, replays committed row mutations, rebuilds indexes for every persisted database, and only then accepts connections. Storage snapshots use temporary-file replacement to avoid exposing a partially written JSON store. Back up both `data/store.json` and `data/wal/` together.

WAL files created by the pre-`0.2.0` development baseline are read as legacy JSONL during migration; all new records use the framed binary format.

## Development layout

```text
src/
├── auth/       bcrypt and JWT user management
├── config/     Convict configuration
├── executor/   SQL command execution
├── indexes/    ordered index implementation
├── network/    framed TCP server
├── parser/     grammar, tokenizer, and AST
├── storage/    catalog and storage adapters
├── wal/        write-ahead log
└── shared/     domain types and errors
tests/          focused unit tests
documentation.md full architecture specification
```

## Roadmap

1. Replace the portable file adapter with a tested native RocksDB adapter.
2. Complete WAL checksum, checkpoint, and crash replay semantics.
3. Persist and reload B+ tree pages rather than rebuilding indexes on startup.
4. Add query planning operators and broader SQL semantics.
5. Add multi-statement transactions and MVCC in a later phase.

See the milestone plan and future extension strategy in [documentation.md](documentation.md).
