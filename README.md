# agent-mysql

MySQL CLI tool designed for AI Agents. All commands output JSON for programmatic consumption.

## Install

```bash
npm install -g agent-mysql
```

## Quick Start

```bash
# Connect and query (full connection info required each time)
agent-mysql -h localhost -P 3306 -u root -p mypassword -d mydb query "SELECT * FROM users LIMIT 5"

# Use DSN
agent-mysql --dsn "mysql://root:mypassword@localhost:3306/mydb" tables

# Save a profile (config saved to ./.agent-mysql/config.json)
agent-mysql config set dev.host localhost
agent-mysql config set dev.user root
agent-mysql config set dev.password mypassword
agent-mysql config set dev.database mydb

# Use saved profile (no need to repeat host/user/pass each time)
agent-mysql --use dev query "SELECT COUNT(*) FROM users"

# Override database on the fly
agent-mysql --use dev -d other_db query "SELECT * FROM posts"
```

## Connection

每条命令都是**独立连接**，用完即关闭。有三种方式指定连接信息：

**方式一：命令行参数（每条命令都要传）**
```bash
agent-mysql -h localhost -P 3306 -u root -p mypass -d mydb query "SELECT 1"
```

**方式二：DSN 连接串**
```bash
agent-mysql --dsn "mysql://root:mypass@localhost:3306/mydb" tables
```

**方式三：配置文件 profile（推荐）**
```bash
# 首次保存
agent-mysql config set dev.host localhost
agent-mysql config set dev.port 3306
agent-mysql config set dev.user root
agent-mysql config set dev.password mypass
agent-mysql config set dev.database mydb

# 之后使用
agent-mysql --use dev query "SELECT 1"
# 也可覆盖数据库
agent-mysql --use dev -d other_db query "SELECT 1"
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
