import { Connection } from 'mysql2/promise'
import { executeSQL } from '../core/executor'
import { formatSuccess, formatError } from '../core/formatter'

export async function statusCommand(
  conn: Connection,
  all: boolean
): Promise<string> {
  try {
    const startTime = Date.now()

    const [versionResult, dbResult, uptimeResult, aliveResult] = await Promise.all([
      executeSQL(conn, 'SELECT VERSION() AS v'),
      executeSQL(conn, 'SELECT DATABASE() AS db'),
      executeSQL(conn, 'SELECT VARIABLE_VALUE AS val FROM performance_schema.global_status WHERE VARIABLE_NAME = "Uptime"'),
      conn.ping().then(() => true).catch(() => false),
    ])

    const connection = {
      host: (conn as any).connection?.config?.host || 'unknown',
      port: (conn as any).connection?.config?.port || 3306,
      user: (conn as any).connection?.config?.user || 'unknown',
      database: (dbResult.rows[0] as any)?.db || null,
      version: (versionResult.rows[0] as any)?.v || 'unknown',
      uptime: (uptimeResult.rows[0] as any)?.val ? `${(uptimeResult.rows[0] as any).val}s` : 'unknown',
      alive: aliveResult,
    }

    const output: Record<string, unknown> = {
      command: 'status',
      duration: ((Date.now() - startTime) / 1000).toFixed(3) + 's',
      connection,
    }

    if (all) {
      const sizeResult = await getDatabaseSize(conn)
      const slowResult = await getSlowQueryInfo(conn)
      const variablesResult = await getVariables(conn)
      output.size = sizeResult
      output.slow = slowResult
      output.variables = variablesResult
    }

    return formatSuccess(output)
  } catch (err: any) {
    return formatError('status', err)
  }
}

async function getDatabaseSize(conn: Connection) {
  try {
    const db = (await executeSQL(conn, 'SELECT DATABASE() AS db')).rows[0] as any
    if (!db?.db) return null

    const result = await executeSQL(
      conn,
      `SELECT table_name AS t, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY size_mb DESC`,
      [db.db]
    )

    const total = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.size_mb || '0'), 0)
    const tables: Record<string, string> = {}
    result.rows.forEach((r: any) => {
      tables[r.t] = `${r.size_mb} MB`
    })

    return { database: `${total.toFixed(2)} MB`, tables }
  } catch (err) {
    return null
  }
}

async function getSlowQueryInfo(conn: Connection) {
  try {
    const [countResult, timeResult] = await Promise.all([
      executeSQL(conn, "SELECT VARIABLE_VALUE AS val FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Slow_queries'"),
      executeSQL(conn, "SELECT VARIABLE_VALUE AS val FROM performance_schema.global_variables WHERE VARIABLE_NAME = 'long_query_time'"),
    ])
    return {
      slow_queries: parseInt((countResult.rows[0] as any)?.val || '0'),
      long_query_time: parseFloat((timeResult.rows[0] as any)?.val || '10'),
    }
  } catch {
    return null
  }
}

async function getVariables(conn: Connection) {
  try {
    const names = ['max_connections', 'innodb_buffer_pool_size', 'wait_timeout', 'interactive_timeout']
    const placeholders = names.map(() => '?').join(', ')
    const result = await executeSQL(
      conn,
      `SELECT VARIABLE_NAME AS n, VARIABLE_VALUE AS v FROM performance_schema.global_variables WHERE VARIABLE_NAME IN (${placeholders})`,
      names
    )
    const vars: Record<string, string> = {}
    result.rows.forEach((r: any) => { vars[r.n] = r.v })
    return vars
  } catch {
    return null
  }
}
