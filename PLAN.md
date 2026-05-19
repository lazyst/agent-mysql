# agent-mysql CLI 工具计划（面向 AI Agent）

## 一、定位

一个专为 **AI Agent（LLM）** 设计的 MySQL 命令行工具。Agent 通过调用 CLI 来操作数据库，一切设计围绕**机器可读、低歧义、可组合**展开。

------------------------------------------------------------------------

## 二、核心设计原则

| 原则 | 说明 |
|------------------------------------|------------------------------------|
| **JSON 优先** | 所有命令默认输出 JSON，方便 Agent 程序化解析 |
| **零交互** | 无需密码输入提示、无需确认、无需选择 — 一切参数化 |
| **幂等执行** | 相同输入产生相同输出，无隐藏状态 |
| **错误结构化** | 错误返回 JSON `{ "error": { "code": "...", "message": "..." } }` |
| **显式连接** | 每次调用指定连接，避免状态泄漏 |
| **可组合** | 输出可 pipe，支持 `--silent` |

------------------------------------------------------------------------

## 三、命令设计

### 3.1 连接方式

``` bash
agent-mysql -h localhost -P 3306 -u root -p pass123 -d mydb <command>
agent-mysql --dsn "mysql://root:pass123@localhost:3306/mydb" <command>
agent-mysql --use prod <command>
```

### 3.2 精简命令列表（共 12 个命令）

```
# ── 通用查询 ──
query <sql> [--params JSON] [--limit N] [--offset N] [--force]
  # 万能 SQL 执行器，涵盖 SELECT/INSERT/UPDATE/DELETE/DDL/存储过程/CALL/EXPLAIN/KILL
  # --force: 允许执行 DROP/TRUNCATE 等破坏性操作（默认拒绝）
  # --params: 预处理语句参数
  # --limit/--offset: 分页

# ── 元数据 ──
databases                          # 列出所有数据库
tables [--database <db>]           # 列出表
desc <table>                       # 表结构（列 + 索引信息一并返回）
schema <table>                     # SHOW CREATE TABLE
status [--all]                     # 连接状态 + ping + 库表大小 + 变量 + 慢查询（--all 展开全部）

# ── 数据操作 ──
insert <table> --data <json> [--upsert] [--keys JSON]
  # --data: 单行对象或数组（批量）
  # --upsert: INSERT ON DUPLICATE KEY UPDATE
  # --keys: 指定唯一键列名
update <table> --set <json> --where <string> [--force]
delete <table> --where <string> [--force]
  # --where 为必填，防止全表误操作
  # --force: 允许全表更新/删除（--where "1=1"）或 DDL 操作

# ── 导入导出 ──
export <table> [--format json|csv|sql] [--output <file>] [--where <sql>]
import <file> [--table <name>] [--format auto|json|csv|sql]

# ── 配置 ──
config set <key> <value>
config get [<key>]
config list
config remove <key>
config test <profile>
```

### 3.3 合并对照说明

| 原计划命令 | 处理方式 | 原因 |
|------------------------------|-------------------------|------------------|
| `create-db` | 删除，用 `query` | 纯 SQL 包装，无额外逻辑 |
| `drop-db` | 删除，用 `query --force` | 同上，`--force` 已在 query 层统一控制 |
| `create-table` | 删除，用 `query` | 纯 SQL 包装 |
| `truncate` | 删除，用 `query --force` | 同上 |
| `drop-table` | 删除，用 `query --force` | 同上 |
| `indexes` | 合并到 `desc` | desc 一次性返回列+索引，Agent 少一次调用 |
| `ping` | 合并到 `status` | status 默认包含连接存活检测 |
| `size` | 合并到 `status --all` | 属于状态信息的一部分 |
| `variables` | 合并到 `status --all` | 同上 |
| `slow` | 合并到 `status --all` | 同上 |
| `upsert` | 合并到 `insert --upsert` | 同一写操作，用参数区分 |
| `nl` / `nl-dry` / `suggest-schema` | 删除 | AI 功能取消 |
| `explain` | 删除，用 `query "EXPLAIN ..."` | 等价于 query + 固定 SQL |
| `processlist` | 删除，用 `query "SHOW FULL PROCESSLIST"` | 同上 |
| `kill` | 删除，用 `query "KILL <id>"` | 同上 |
| `call` | 删除，用 `query "CALL proc(...)"` | 同上 |

**精简效果：25 个命令 → 12 个命令**

------------------------------------------------------------------------

## 四、输出格式规范

### 成功响应

``` json
{
  "success": true,
  "command": "query",
  "duration": "0.012s",
  "rows": 5,
  "fields": [
    { "name": "id", "type": "INT", "nullable": false },
    { "name": "name", "type": "VARCHAR(255)", "nullable": true }
  ],
  "data": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ]
}
```

### 错误响应

``` json
{
  "success": false,
  "error": {
    "code": "ER_DUP_ENTRY",
    "message": "Duplicate entry 'alice@example.com' for key 'users.email'",
    "sqlState": "23000",
    "errno": 1062
  },
  "command": "query",
  "sql": "INSERT INTO users(email) VALUES('alice@example.com')"
}
```

### desc 响应（列 + 索引合并）

``` json
{
  "success": true,
  "command": "desc",
  "table": "users",
  "columns": [
    { "field": "id", "type": "int", "null": "NO", "key": "PRI", "default": null, "extra": "auto_increment" },
    { "field": "name", "type": "varchar(255)", "null": "YES", "key": "", "default": null, "extra": "" }
  ],
  "indexes": [
    { "key_name": "PRIMARY", "column_name": "id", "non_unique": 0, "seq_in_index": 1 },
    { "key_name": "idx_email", "column_name": "email", "non_unique": 1, "seq_in_index": 1 }
  ]
}
```

### status --all 响应

``` json
{
  "success": true,
  "command": "status",
  "connection": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "database": "mydb",
    "version": "8.0.32",
    "uptime": "12d 3h",
    "alive": true
  },
  "size": {
    "database": "256.4 MB",
    "tables": { "users": "45.2 MB", "posts": "120.1 MB" }
  },
  "slow": {
    "slow_queries": 3,
    "long_query_time": 2.0
  },
  "variables": {
    "max_connections": 151,
    "innodb_buffer_pool_size": "134217728"
  }
}
```

------------------------------------------------------------------------

## 五、技术选型

| 模块       | 技术                  | 理由                                |
|------------|-----------------------|-------------------------------------|
| 语言       | Node.js + TypeScript  | 类型安全，输出结构化                |
| CLI 框架   | `commander`           | 子命令支持好                        |
| MySQL 驱动 | `mysql2`              | Promise 原生，预处理安全            |
| 输出       | 原生 `JSON.stringify` | 零依赖                              |
| 表格输出   | `cli-table3`          | 可选的 `--format table`             |
| CSV        | 内置实现              | 轻量                                |
| 配置       | 原生 JSON 文件        | 存储在 `~/.agent-mysql/config.json` |
| 构建       | `tsup`                | 单文件 CLI                          |
| 测试       | `vitest`              | 轻量快速                            |

------------------------------------------------------------------------

## 六、文件结构

```         
agent-mysql/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                    # 入口
│   ├── cli.ts                      # commander 命令注册
│   ├── types.ts                    # 公共类型定义
│   ├── commands/
│   │   ├── query.ts                # query（含 --force 保护）
│   │   ├── metadata.ts             # databases, tables, desc, schema
│   │   ├── status.ts               # status（含 ping/size/variables/slow）
│   │   ├── dml.ts                  # insert/update/delete
│   │   ├── export.ts               # export
│   │   ├── import.ts               # import
│   │   └── config-cmd.ts           # config 子命令
│   ├── core/
│   │   ├── connection.ts           # 连接管理
│   │   ├── executor.ts             # SQL 执行器 + 结果格式化
│   │   ├── formatter.ts            # 输出格式化（JSON/表格/CSV）
│   │   └── error-handler.ts        # 统一错误处理
│   ├── config/
│   │   └── store.ts                # 配置读写
│   └── utils/
│       ├── dsn-parser.ts           # DSN 解析
│       └── type-mapper.ts          # MySQL 类型映射
├── bin/
│   └── agent-mysql.js              # CLI 入口
└── README.md
```

------------------------------------------------------------------------

## 七、开发阶段

| 阶段 | 内容 | 预估 |
|------------------------|------------------------|------------------------|
| **Phase 0** | 项目初始化：TypeScript + tsup + 基础结构 | 0.5天 |
| **Phase 1** | 核心引擎：连接管理 + executor + JSON 输出 + 错误处理 | 1.5天 |
| **Phase 2** | 连接方式：`-h/-u/-p` + `--dsn` + `--use profile` | 0.5天 |
| **Phase 3** | `query` 命令（含 `--params`/`--limit`/`--offset`/`--force`） | 1天 |
| **Phase 4** | 元数据命令：`databases/tables/desc/schema` | 1天 |
| **Phase 5** | `status` 命令（含 ping/size/variables/slow） | 0.5天 |
| **Phase 6** | DML 命令：`insert( --upsert)/update/delete` | 1天 |
| **Phase 7** | 导入导出：`export/import` | 1天 |
| **Phase 8** | 配置管理：`config set/get/list/remove/test` | 0.5天 |
| **Phase 9** | 测试 + README + npm 发布 | 0.5天 |

**总计：约 7 天**

------------------------------------------------------------------------

## 八、与纯人用工具的差异对比

| 维度   | 人用工具            | Agent 用工具（本工具）           |
|--------|---------------------|----------------------------------|
| 输出   | 彩色表格、分页      | **JSON stdout**，机器可解析      |
| 交互   | REPL 终端、密码提示 | **无交互**，全部参数化           |
| 连接   | 一次连接持续使用    | **每次命令独立连接**             |
| 错误   | 打印红色错误        | **JSON 错误对象**，含 code/errno |
| 大结果 | less 分页           | `--limit` + `--offset` 分页      |
| 模糊性 | 有默认行为          | **零歧义**，参数明确指定         |

------------------------------------------------------------------------

## 九、Agent 调用示例

``` bash
# 查询
agent-mysql --use prod query "SELECT COUNT(*) as cnt FROM users WHERE status='active'"
# → {"success":true,"data":[{"cnt":1523}],...}

# DDL 也走 query（统一入口）
agent-mysql --use dev query "CREATE TABLE posts (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL)"
# → {"success":true,"command":"query","affectedRows":0}

# EXPLAIN 也走 query
agent-mysql --use dev query "EXPLAIN SELECT * FROM users WHERE email='a@b.com'"
# → {"success":true,"data":[{"id":1,"select_type":"SIMPLE","table":"users","type":"ALL","rows":1000,"Extra":"Using where"}]}

# KILL 也走 query
agent-mysql --use dev query "KILL 123"
# → {"success":true,"affectedRows":0}

# 破坏性操作需要 --force
agent-mysql --use dev query "DROP TABLE posts"
# → {"success":false,"error":{"code":"ER_DESTRUCTIVE","message":"Destructive operation requires --force flag"}}

# 探索表结构（一次调用返回列+索引）
agent-mysql --use dev desc users
# → 返回 columns + indexes

# 一键获取全部状态
agent-mysql --use prod status --all
# → 返回连接信息 + 大小 + 变量 + 慢查询

# 插入 + upsert
agent-mysql --use dev insert users --data '{"name":"Alice","email":"a@b.com"}' --upsert --keys '["email"]'
# → {"success":true,"insertId":101,"affectedRows":1}
```

------------------------------------------------------------------------

## 十、安全考虑

1.  **密码不打印** — 所有输出自动遮盖密码
2.  **预处理语句** — `--params` 使用 `mysql2` 预处理，防 SQL 注入
3. **--where 必填** — `update`/`delete` 命令强制要求 `--where` 参数，Agent 必须显式指定条件才允许执行。确有全表更新需求需额外加 `--force`
4. **--force 保护** — `query` 默认拒绝 DROP/TRUNCATE/ALTER/DELETE（无 WHERE），需显式加 `--force`
4.  **限流保护** — 默认 `--limit 200`，防止全表扫描 OOM
5.  **超时控制** — 默认连接超时 10s，查询超时 30s