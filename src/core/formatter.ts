/** Escape a SQL identifier (table/column name) by doubling internal backticks */
export function escapeId(id: string): string {
  return '`' + id.replace(/`/g, '``') + '`'
}

export function formatSuccess(data: Record<string, unknown>): string {
  return JSON.stringify({ success: true, ...data })
}

export function formatError(
  command: string,
  err: any,
  sql?: string
): string {
  const error = {
    code: err.code || 'ER_UNKNOWN',
    message: err.message || String(err),
    sqlState: err.sqlState || undefined,
    errno: err.errno || undefined,
  }
  const result: Record<string, unknown> = {
    success: false,
    error,
    command,
  }
  if (sql) result.sql = sql
  return JSON.stringify(result)
}
