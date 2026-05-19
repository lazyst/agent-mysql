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

/**
 * Check if a WHERE clause is trivially always-true (e.g. `1=1`, `TRUE`, `1`).
 * Strips SQL comments and normalizes whitespace before checking.
 */
export function isAlwaysTrueWhere(where: string): boolean {
  const cleaned = where
    .replace(/--.*$/gm, '')
    .replace(/#.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
  if (!cleaned) return true

  const s = cleaned.replace(/\s+/g, '')
  const u = s.toUpperCase()

  if (s === '1' || u === 'TRUE') return true

  // Numeric comparison that always evaluates to true (e.g. 1=1, 2>1)
  const numCmp = s.match(/^(\d+)([=<>!]+)(\d+)$/)
  if (numCmp) {
    const a = parseInt(numCmp[1], 10), op = numCmp[2], b = parseInt(numCmp[3], 10)
    switch (op) {
      case '=': case '==': return a === b
      case '!=': case '<>': return a !== b
      case '>': return a > b
      case '<': return a < b
      case '>=': return a >= b
      case '<=': return a <= b
    }
  }

  return false
}
