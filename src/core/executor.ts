import { Connection } from 'mysql2/promise'
import { RowDataPacket, ResultSetHeader, FieldPacket } from 'mysql2'

export interface ExecResult {
  rows: any[]
  fields: { name: string; type: string; nullable: boolean }[]
  affectedRows?: number
  insertId?: number
  warning?: string
}

export async function executeSQL(conn: Connection, sql: string, params?: any[]): Promise<ExecResult> {
  const [result, fields] = await conn.execute(sql, params || [])

  if (Array.isArray(result)) {
    const rows = result as RowDataPacket[]
    return {
      rows,
      fields: (fields as FieldPacket[]).map(f => ({
        name: f.name,
        type: f.type?.toString() || 'unknown',
        nullable: !f.flags || !(Number(f.flags) & 1),
      })),
    }
  }

  const header = result as ResultSetHeader
  return {
    rows: [],
    fields: [],
    affectedRows: header.affectedRows,
    insertId: header.insertId,
    warning: header.warningStatus ? `Warning code: ${header.warningStatus}` : undefined,
  }
}
