# agent-mysql 深度审阅报告

## 发现的 Bug 和问题

### 🐛 Bug 1：DSN 解析不支持密码中的 `@` 和数据库名中的特殊字符

`src/utils/dsn-parser.ts:3`

```typescript
const DSN_REGEX = /^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)(?:\/(\w+))?$/
```

两个问题：
- 密码含 `@` 会解析错误（如 `pass@word`）
- 数据库名只匹配 `\w+`，不支持 `-`、`.`、数字开头等（如 `my-db_v2` 的 `-` 会被截断）

### 🐛 Bug 2：`export --format csv` 的 CSV 表头未转义

`src/commands/import-export.ts:31`

```typescript
const csvLines = [headers.join(',')]
```

如果列名本身包含逗号或引号（如 `my,name`），表头不会被正确转义。读取此类 CSV 文件时会导致列错位。

### 🐛 Bug 3：`import` SQL 文件解析过于简单

`src/commands/import-export.ts:122-125`

```typescript
content.split(';').filter(s => !s.startsWith('--') && !s.startsWith('#'))
```

- 仅检查行首注释，不处理行中注释 `SELECT 1; -- 注释`
- 不处理多行注释 `/* ... */`
- 分号分割会破坏存储过程/函数定义

### 🐛 Bug 4：`insert` 批量插入时如果行键不一致会静默丢数据

`src/commands/dml.ts:26`

```typescript
const columns = Object.keys(rows[0])
```

如果 `--data '[{"a":1},{"b":2}]'`，第二行的 `b` 会被忽略，且不会报错。

### 🐛 Bug 5：`getConfigPath()` 定义但从未使用

`src/config/store.ts:8-10` — 死代码。

### 🐛 Bug 6：`detectFormat` 的 `_content` 参数未使用

`src/commands/import-export.ts:147` — 形参 `_content` 从未被引用，多余参数。

### 🧹 代码质量问题

| 问题 | 位置 | 说明 |
|------|------|------|
| 未使用的类型定义 | `src/types.ts` | `QueryResult`、`ErrorResult`、`DescResult`、`StatusResult` 定义了但未被任何函数使用 |
| `tables` 命令的 `--database` 与全局 `-d` 重叠 | `src/cli.ts:122` | 行为可工作但语义模糊 |
| SQL 文件导入不支持多语句事务 | `import-export.ts:122` | `DELIMITER` 不支持 |

## 总结

**严重 Bug：1 个** — DSN 解析对特殊字符支持不完整  
**功能 Bug：3 个** — CSV 表头、批量插入不一致、SQL 文件解析  
**代码质量问题：3 处** — 死代码、未使用参数、未使用类型

建议优先修复 DSN 解析和 CSV 表头转义，其余不影响正常使用。
