import { Connection } from 'mysql2/promise'
import { executeSQL } from '../core/executor'
import { formatSuccess, formatError, escapeId } from '../core/formatter'
import { isAlwaysTrueWhere } from '../core/error-handler'

export async function insertCommand(
  conn: Connection,
  table: string,
  data: any,
  upsert: boolean,
  keys?: string[]
): Promise<string> {
  try {
    let rows: Record<string, any>[]
    if (Array.isArray(data)) {
      rows = data
    } else if (typeof data === 'object' && data !== null) {
      rows = [data]
    } else {
      return formatError('insert', { code: 'ER_INVALID_DATA', message: '--data must be a JSON object or array' })
    }

    if (rows.length === 0) {
      return formatError('insert', { code: 'ER_EMPTY_DATA', message: 'No data provided' })
    }

    const columns = Object.keys(rows[0])

    // Check all rows have same keys
    for (let i = 1; i < rows.length; i++) {
      const keys = Object.keys(rows[i])
      const diff = keys.filter(k => !columns.includes(k)).concat(columns.filter(k => !keys.includes(k)))
      if (diff.length > 0) {
        return formatError('insert', {
          code: 'ER_INCONSISTENT_KEYS',
          message: `Row ${i} has different keys than row 0: ${diff.join(', ')}`,
        })
      }
    }
    const placeholders = columns.map(() => '?').join(', ')
    const columnList = columns.map(escapeId).join(', ')

    let sql = `INSERT INTO ${escapeId(table)} (${columnList}) VALUES (${placeholders})`

    if (upsert && keys && keys.length > 0) {
      const updates = columns
        .filter(c => !keys.includes(c))
        .map(c => `${escapeId(c)} = VALUES(${escapeId(c)})`)
      if (updates.length > 0) {
        sql += ` ON DUPLICATE KEY UPDATE ${updates.join(', ')}`
      }
    }

    let totalAffected = 0
    let lastInsertId: number | undefined

    for (const row of rows) {
      const values = columns.map(c => row[c])
      const result = await executeSQL(conn, sql, values)
      totalAffected += result.affectedRows || 0
      if (result.insertId && result.insertId > 0) {
        lastInsertId = result.insertId
      }
    }

    return formatSuccess({
      command: 'insert',
      table,
      affectedRows: totalAffected,
      ...(lastInsertId ? { insertId: lastInsertId } : {}),
    })
  } catch (err: any) {
    return formatError('insert', err)
  }
}

export async function updateCommand(
  conn: Connection,
  table: string,
  setData: Record<string, any>,
  where: string,
  force: boolean
): Promise<string> {
  try {
    if (!where || !where.trim()) {
      return formatError('update', {
        code: 'ER_MISSING_WHERE',
        message: '--where is required for UPDATE. Use --force to allow full table update with --where "1=1"',
      })
    }

    if (!force && isAlwaysTrueWhere(where)) {
      return formatError('update', {
        code: 'ER_FULL_TABLE_UPDATE',
        message: 'Full table UPDATE requires --force flag',
      })
    }

    const columns = Object.keys(setData)
    const sets = columns.map(c => `${escapeId(c)} = ?`).join(', ')
    const values = columns.map(c => setData[c])

    const sql = `UPDATE ${escapeId(table)} SET ${sets} WHERE ${where}`
    const result = await executeSQL(conn, sql, values)

    return formatSuccess({
      command: 'update',
      table,
      affectedRows: result.affectedRows || 0,
      warning: result.warning,
    })
  } catch (err: any) {
    return formatError('update', err)
  }
}

export async function deleteCommand(
  conn: Connection,
  table: string,
  where: string,
  force: boolean
): Promise<string> {
  try {
    if (!where || !where.trim()) {
      return formatError('delete', {
        code: 'ER_MISSING_WHERE',
        message: '--where is required for DELETE. Use --force to allow full table delete with --where "1=1"',
      })
    }

    if (!force && isAlwaysTrueWhere(where)) {
      return formatError('delete', {
        code: 'ER_FULL_TABLE_DELETE',
        message: 'Full table DELETE requires --force flag',
      })
    }

    const sql = `DELETE FROM ${escapeId(table)} WHERE ${where}`
    const result = await executeSQL(conn, sql)

    return formatSuccess({
      command: 'delete',
      table,
      affectedRows: result.affectedRows || 0,
    })
  } catch (err: any) {
    return formatError('delete', err)
  }
}
