import { ConnectionOptions } from '../types'

const DSN_REGEX = /^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)(?:\/(\w+))?$/

export function parseDSN(dsn: string): ConnectionOptions | null {
  const match = dsn.match(DSN_REGEX)
  if (!match) return null
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5] || undefined,
  }
}
