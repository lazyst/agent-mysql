---
name: agent-mysql
description: "MySQL database management via CLI — execute queries, list databases/tables, describe schemas, insert/update/delete data with safety guards, and export/import datasets in JSON/CSV/SQL. Use when the user needs to: (1) Run SQL queries, \"查一下数据库\", or execute any SQL against MySQL, (2) Explore database structure — list databases, tables, columns, indexes, or view CREATE TABLE, (3) Insert, update, or delete rows, \"加一条记录\", \"改个字段\", \"删掉数据\", (4) Export or import table data in JSON/CSV/SQL, (5) Check MySQL server status, database size, slow queries, or variables, (6) Manage saved connection profiles. Trigger keywords: MySQL, 数据库, SQL, 表, 数据, 查询, 导入, 导出, agent-mysql."
---

# agent-mysql — MySQL CLI for AI Agents

## Prerequisite

`agent-mysql` must be installed globally. Before using any command, verify availability:

```bash
# Check if installed
if (-not (Get-Command agent-mysql -ErrorAction SilentlyContinue)) {
  # Agent should inform user and suggest: npm install -g agent-mysql
  Write-Error "agent-mysql not found. Please run: npm install -g agent-mysql"
}
```

On Linux/macOS:
```bash
if ! command -v agent-mysql &>/dev/null; then
  echo "agent-mysql not found. Install: npm install -g agent-mysql"
fi
```

## Overview

`agent-mysql` is a CLI tool that outputs **JSON only** (except export without `--output`). Every command creates an **independent connection** and closes it after execution.

## Connection Methods

Pick one per command (ordered by priority):

| Method | Example | When to use |
|--------|---------|-------------|
| Saved profile | `--use dev` | Saved with `config set`; can override: `--use dev -d other_db` |
| DSN | `--dsn mysql://user:pass@host:3306/db` | One-off connections |
| CLI flags | `-h localhost -P 3306 -u root -p mypass -d mydb` | Ad-hoc connections |

If no connection info is given, the default profile is used. If none exists, the command fails with `ER_NO_CONNECTION`.

## Safety Guards

| Guard | Trigger | Bypass |
|-------|---------|--------|
| DROP/TRUNCATE/ALTER/RENAME blocked | Any SQL containing these keywords | `--force` flag |
| DELETE/UPDATE without WHERE blocked | No WHERE clause found in SQL | `--force` flag |
| Full-table UPDATE/DELETE blocked | WHERE is always-true (1=1, TRUE, etc.) | `--force` flag |
| SELECT auto-limited | First SELECT without explicit LIMIT gets `LIMIT 200` | Pass `--limit 0` to disable |

## Best Practices for AI Agents

- **Always prefer `--use <profile>`** — avoids repeating credentials and leaking passwords in command history
- **Always validate before destructive ops** — query first (`SELECT COUNT(*)` / `SELECT * LIMIT 5`), then run the mutation
- **Batch inserts** use `insert --data '[{...},{...}]'` — keys must be consistent across all rows
- **Use `--where` carefully** — agent-mysql blocks full-table UPDATE/DELETE but does not validate WHERE correctness
- **Check status before diagnosing** — `status --all` returns connection info, DB size, slow queries, and key variables

## Commands Quick Reference

| Command | Description | Key flags |
|---------|-------------|-----------|
| `query <sql>` | Execute any SQL | `--params <json>`, `--limit N`, `--offset N`, `--force` |
| `databases` | List all databases | — |
| `tables` | List tables (current DB) | `--database <db>` |
| `desc <table>` | Columns + indexes | — |
| `schema <table>` | CREATE TABLE statement | — |
| `status` | Connection health | `--all` for size/slow/variables |
| `insert <table>` | Insert row(s) | `--data <json>`, `--upsert`, `--keys <json>` |
| `update <table>` | Update rows | `--set <json>`, `--where <sql>`, `--force` |
| `delete <table>` | Delete rows | `--where <sql>`, `--force` |
| `export <table>` | Export data | `--format json\|csv\|sql`, `--output <file>`, `--where <sql>` |
| `import <file>` | Import from file | `--table <name>`, `--format auto\|json\|csv\|sql` |
| `config` | Manage profiles | Subcommands: `set`, `get`, `list`, `remove`, `use`, `test` |

See [references/commands.md](references/commands.md) for full detail on every command including response format.

## Profile Management

```json
# Save a profile
config set dev.host localhost
config set dev.port 3306
config set dev.user root
config set dev.password mypass
config set dev.database mydb

# Use it
--use dev

# Override database
--use dev -d other_db

# List all profiles
config list

# Test connection
config test dev
```

Passwords are masked as `***` in all output.
