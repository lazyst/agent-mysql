import { Connection } from 'mysql2/promise'

const DESTRUCTIVE_PATTERNS = [
  /^\s*DROP\s/i,
  /^\s*TRUNCATE\s/i,
  /^\s*ALTER\s/i,
  /^\s*RENAME\s/i,
]

const DANGEROUS_DML = [
  /^\s*DELETE\s(?!.*\sWHERE\s)/is,
  /^\s*UPDATE\s(?!.*\sWHERE\s)/is,
]

export function isDestructive(sql: string): boolean {
  const trimmed = sql.trim().replace(/\s+/g, ' ')
  return DESTRUCTIVE_PATTERNS.some(p => p.test(trimmed))
}

export function isDangerousDML(sql: string): boolean {
  const trimmed = sql.trim().replace(/\s+/g, ' ')
  return DANGEROUS_DML.some(p => p.test(trimmed))
}

export function validateSQL(sql: string, force: boolean): string | null {
  if (!force) {
    if (isDestructive(sql)) {
      return 'Destructive operations (DROP/TRUNCATE/ALTER/RENAME) require --force flag'
    }
    if (isDangerousDML(sql)) {
      return 'DELETE/UPDATE without WHERE clause requires --force flag'
    }
  }
  return null
}
