import { Connection } from 'mysql2/promise'
import { executeSQL } from '../core/executor'
import { validateSQL } from '../core/error-handler'
import { formatSuccess, formatError } from '../core/formatter'

export async function queryCommand(
  conn: Connection,
  sql: string,
  options: { params?: any[]; limit?: number; offset?: number; force?: boolean }
): Promise<string> {
  const startTime = Date.now()

  const validationError = validateSQL(sql, !!options.force)
  if (validationError) {
    return formatError('query', { code: 'ER_DESTRUCTIVE', message: validationError }, sql)
  }

  let finalSQL = sql
  const isSelectQuery = /^\s*(?:WITH\b[\s\S]*\bSELECT\b|SELECT)\s/is.test(sql)

  let hasExistingLimit = /\bLIMIT\s+\d+/i.test(finalSQL)
  if (options.limit && isSelectQuery) {
    if (!hasExistingLimit) {
      finalSQL = `${finalSQL.replace(/;?\s*$/, '')} LIMIT ${options.limit}`
      hasExistingLimit = true
    }
  }
  if (options.offset && isSelectQuery) {
    const hasOffset = /\bOFFSET\s+\d+/i.test(finalSQL)
    if (!hasOffset) {
      if (!hasExistingLimit) {
        finalSQL = `${finalSQL.replace(/;?\s*$/, '')} LIMIT 18446744073709551615`
      }
      finalSQL = `${finalSQL.replace(/;?\s*$/, '')} OFFSET ${options.offset}`
    }
  }

  try {
    const result = await executeSQL(conn, finalSQL, options.params)
    const duration = ((Date.now() - startTime) / 1000).toFixed(3) + 's'

    const output: Record<string, unknown> = {
      command: 'query',
      duration,
    }

    if (result.rows.length > 0) {
      output.rows = result.rows.length
      output.fields = result.fields
      output.data = result.rows
    }

    if (result.affectedRows !== undefined) {
      output.affectedRows = result.affectedRows
    }
    if (result.insertId !== undefined && result.insertId > 0) {
      output.insertId = result.insertId
    }
    if (result.warning) {
      output.warning = result.warning
    }

    return formatSuccess(output)
  } catch (err: any) {
    return formatError('query', err, finalSQL)
  }
}
