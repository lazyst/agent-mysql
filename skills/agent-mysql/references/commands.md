# agent-mysql Command Reference

All commands output JSON. Success: `{"success": true, ...}`. Error: `{"success": false, "error": {"code": "...", "message": "..."}}`.

## query

Execute arbitrary SQL. Most versatile command — handles SELECT, INSERT, UPDATE, DELETE, DDL.

```bash
agent-mysql --use dev query "SELECT * FROM users LIMIT 5"
agent-mysql --use dev query "INSERT INTO logs (msg) VALUES (?)" --params '["hello"]'
agent-mysql --use dev query "SELECT * FROM users" --limit 10 --offset 20
agent-mysql --use dev query "DROP TABLE old_backup" --force
```

**Response** (SELECT):
```json
{"success":true,"command":"query","duration":"0.012s","rows":5,"fields":[{"name":"id","type":"8","nullable":false}],"data":[...]}
```

**Response** (INSERT/UPDATE/DELETE):
```json
{"success":true,"command":"query","duration":"0.005s","affectedRows":3,"insertId":42}
```

## databases

```bash
agent-mysql --use dev databases
# {"success":true,"command":"databases","databases":["campus","mysql","test"]}
```

## tables

```bash
agent-mysql --use dev tables
agent-mysql --use dev tables --database campus
```

## desc

Shows columns + indexes in one call.

```bash
agent-mysql --use dev desc users
# {"success":true,"command":"desc","table":"users","columns":[...],"indexes":[...]}
```

## schema

Shows the CREATE TABLE DDL.

```bash
agent-mysql --use dev schema users
# {"success":true,"command":"schema","table":"users","createSQL":"CREATE TABLE `users` (...)"}
```

## status

```bash
agent-mysql --use dev status
# {"success":true,"command":"status","duration":"0.023s","connection":{"host":"...","port":3306,...}}

agent-mysql --use dev status --all
# Adds size, slow, variables fields
```

## insert

```bash
# Single row
agent-mysql --use dev insert users --data '{"name":"Alice","email":"a@b.com"}'

# Batch (keys must match)
agent-mysql --use dev insert users --data '[{"name":"A"},{"name":"B"}]'

# Upsert
agent-mysql --use dev insert users --data '{"id":1,"name":"Alice"}' --upsert --keys '["id"]'
```

## update

`--where` is required. Full-table update requires `--force`.

```bash
agent-mysql --use dev update users --set '{"name":"Bob"}' --where "id=1"
agent-mysql --use dev update users --set '{"status":"active"}' --where "1=1" --force
```

## delete

`--where` is required. Full-table delete requires `--force`.

```bash
agent-mysql --use dev delete users --where "id=1"
agent-mysql --use dev delete users --where "1=1" --force
```

## export

```bash
# JSON to stdout (raw JSON array)
agent-mysql --use dev export users --format json

# CSV to file
agent-mysql --use dev export users --format csv --output ./users.csv

# SQL INSERT statements
agent-mysql --use dev export users --format sql --output ./users.sql

# Filtered
agent-mysql --use dev export users --where "created_at > '2024-01-01'" --limit 100
```

## import

Format auto-detected from file extension (.json / .csv / .sql). Table name auto-detected from filename.

```bash
agent-mysql --use dev import ./users.json
agent-mysql --use dev import ./data.csv --table users
agent-mysql --use dev import ./backup.sql
```

## config

```bash
config set dev.host localhost     # Set field in profile
config get dev                    # Get entire profile (password masked)
config get dev.host               # Get specific field
config list                        # List all profiles
config remove dev                  # Delete a profile
config use dev                     # Set as default
config test dev                    # Test connection (returns version on success)
```
