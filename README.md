# agent-mysql

MySQL CLI tool designed for AI Agents. All commands output JSON for programmatic consumption.

## Install

```bash
npm install -g agent-mysql
```

## Quick Start

```bash
# Connect and query
agent-mysql -h localhost -u root -p mypassword -d mydb query "SELECT * FROM users LIMIT 5"

# Use DSN
agent-mysql --dsn "mysql://root:mypassword@localhost:3306/mydb" tables

# Save a profile (config saved to ./.agent-mysql/config.json)
agent-mysql config set dev.host localhost
agent-mysql config set dev.user root
agent-mysql config set dev.password mypassword
agent-mysql config set dev.database mydb

# Use saved profile
agent-mysql --use dev query "SELECT COUNT(*) FROM users"
```

## Configuration

配置文件保存在当前项目目录的 `.agent-mysql/config.json` 中。

首次使用可以参考模板文件初始化：

```bash
cp .agent-mysql/config.example.json .agent-mysql/config.json
# 然后编辑 config.json 填入真实密码
```

或者通过命令行逐项设置：

```bash
agent-mysql config set dev.host localhost
agent-mysql config set dev.user root
agent-mysql config set dev.password mypassword
agent-mysql config set dev.database mydb
```

## Commands

| Command | Description |
|---------|-------------|
| `query <sql>` | Execute any SQL (SELECT/INSERT/UPDATE/DELETE/DDL/etc) |
| `databases` | List all databases |
| `tables` | List tables in database |
| `desc <table>` | Describe table (columns + indexes) |
| `schema <table>` | Show CREATE TABLE DDL |
| `status` | Connection status + ping |
| `status --all` | All info: size, variables, slow queries |
| `insert <table> --data <json>` | Insert data from JSON |
| `update <table> --set <json> --where <sql>` | Update data with conditions |
| `delete <table> --where <sql>` | Delete data with conditions |
| `export <table>` | Export table data (json/csv/sql) |
| `import <file>` | Import from JSON/CSV/SQL file |
| `config` | Manage connection profiles |

## Safety

- `DROP/TRUNCATE/ALTER` require `--force` flag
- `DELETE/UPDATE` without `WHERE` require `--force` flag
- `update`/`delete` commands require `--where` parameter
- Default `--limit 200` on SELECT queries
