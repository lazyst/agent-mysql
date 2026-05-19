import mysql, { Connection } from 'mysql2/promise'
import { ConnectionOptions } from '../types'

export async function createConnection(opts: ConnectionOptions, timeout = 10000): Promise<Connection> {
  const conn = await mysql.createConnection({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password,
    database: opts.database,
    connectTimeout: timeout,
  })
  return conn
}

export async function testConnection(opts: ConnectionOptions): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const conn = await createConnection(opts, 5000)
    const [rows] = await conn.execute('SELECT VERSION() AS version')
    const version = (rows as any[])[0]?.version
    await conn.end()
    return { ok: true, version }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
