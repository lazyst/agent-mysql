import { Connection } from 'mysql2/promise'
import { executeSQL } from '../core/executor'
import { formatSuccess, formatError } from '../core/formatter'

export async function databasesCommand(conn: Connection): Promise<string> {
  try {
    const result = await executeSQL(conn, 'SHOW DATABASES')
    const dbs = result.rows.map((r: any) => r.Database)
    return formatSuccess({
      command: 'databases',
      databases: dbs,
    })
  } catch (err: any) {
    return formatError('databases', err)
  }
}

export async function tablesCommand(conn: Connection, database?: string): Promise<string> {
  try {
    if (database) {
      await conn.execute(`USE \`${database}\``)
    }
    const result = await executeSQL(conn, 'SHOW TABLES')
    const tableKey = Object.keys(result.rows[0] || {})[0] || `Tables_in_${database || 'unknown'}`
    const tables = result.rows.map((r: any) => r[tableKey])
    return formatSuccess({
      command: 'tables',
      database: database || null,
      tables,
    })
  } catch (err: any) {
    return formatError('tables', err)
  }
}

export async function descCommand(conn: Connection, table: string): Promise<string> {
  try {
    const columnsResult = await executeSQL(conn, `SHOW COLUMNS FROM \`${table}\``)
    const indexesResult = await executeSQL(conn, `SHOW INDEX FROM \`${table}\``)

    const indexes = indexesResult.rows.map((r: any) => ({
      key_name: r.Key_name,
      column_name: r.Column_name,
      non_unique: r.Non_unique,
      seq_in_index: r.Seq_in_index,
      index_type: r.Index_type || 'BTREE',
    }))

    return formatSuccess({
      command: 'desc',
      table,
      columns: columnsResult.rows.map((r: any) => ({
        field: r.Field,
        type: r.Type,
        null: r.Null,
        key: r.Key,
        default: r.Default,
        extra: r.Extra,
      })),
      indexes,
    })
  } catch (err: any) {
    return formatError('desc', err)
  }
}

export async function schemaCommand(conn: Connection, table: string): Promise<string> {
  try {
    const result = await executeSQL(conn, `SHOW CREATE TABLE \`${table}\``)
    const createSQL = (result.rows[0] as any)?.['Create Table'] || ''
    return formatSuccess({
      command: 'schema',
      table,
      createSQL,
    })
  } catch (err: any) {
    return formatError('schema', err)
  }
}
