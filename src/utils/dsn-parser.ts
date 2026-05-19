import { ConnectionOptions } from '../types'

// Format: mysql://user:password@host:port/database
// password 允许包含 @，通过贪吃匹配到最后一个 @ 来分隔 password 和 host
// IPv6 地址须放在方括号内，如 mysql://user:pass@[::1]:3306/db
const DSN_REGEX = /^mysql:\/\/([^:]+):(.+)@(?:\[([^\]]+)\]|([^:]+)):(\d+)(?:\/(.*))?$/

export function parseDSN(dsn: string): ConnectionOptions | null {
  const match = dsn.match(DSN_REGEX)
  if (!match) return null
  return {
    user: match[1],
    password: match[2],
    host: match[3] || match[4],
    port: parseInt(match[5], 10),
    database: match[6] || undefined,
  }
}
