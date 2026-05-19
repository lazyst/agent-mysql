export interface ConnectionOptions {
  host: string
  port: number
  user: string
  password: string
  database?: string
}

export interface QueryResult {
  success: boolean
  command: string
  duration: string
  rows?: number
  affectedRows?: number
  insertId?: number
  fields?: FieldInfo[]
  data?: Record<string, unknown>[]
  warning?: string
  message?: string
}

export interface FieldInfo {
  name: string
  type: string
  nullable: boolean
}

export interface ErrorResult {
  success: false
  error: {
    code: string
    message: string
    sqlState?: string
    errno?: number
  }
  command: string
  sql?: string
}

export interface DescResult {
  success: true
  command: 'desc'
  table: string
  columns: ColumnInfo[]
  indexes: IndexInfo[]
}

export interface ColumnInfo {
  field: string
  type: string
  null: string
  key: string
  default: string | null
  extra: string
}

export interface IndexInfo {
  key_name: string
  column_name: string
  non_unique: number
  seq_in_index: number
  index_type: string
}

export interface StatusResult {
  success: true
  command: 'status'
  connection: {
    host: string
    port: number
    user: string
    database: string | null
    version: string
    uptime: string
    alive: boolean
  }
  size?: {
    database: string
    tables: Record<string, string>
  }
  slow?: {
    slow_queries: number
    long_query_time: number
  }
  variables?: Record<string, string>
}

export interface ConfigProfile {
  host: string
  port: number
  user: string
  password: string
  database?: string
}

export interface ConfigStore {
  default?: string
  profiles: Record<string, ConfigProfile>
}
