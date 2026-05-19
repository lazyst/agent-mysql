import { Connection } from 'mysql2/promise'
import { executeSQL } from '../core/executor'
import { formatSuccess, formatError } from '../core/formatter'
import * as fs from 'fs'

export async function exportCommand(
  conn: Connection,
  table: string,
  options: { format: string; output?: string; where?: string; limit?: number }
): Promise<string> {
  try {
    let sql = `SELECT * FROM \`${table}\``
    if (options.where) sql += ` WHERE ${options.where}`
    if (options.limit) sql += ` LIMIT ${options.limit}`

    const result = await executeSQL(conn, sql)

    let output: string
    const format = options.format || 'json'

    switch (format) {
      case 'json':
        output = JSON.stringify(result.rows, null, 2)
        break
      case 'csv': {
        if (result.rows.length === 0) {
          output = ''
          break
        }
        const headers = Object.keys(result.rows[0])
        const csvLines = [headers.join(',')]
    for (const row of result.rows) {
      csvLines.push(headers.map(h => {
        let val = (row as any)[h]
        if (val === null || val === undefined) return ''
        if (val instanceof Date) val = val.toISOString().replace('T', ' ').replace('Z', '')
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(','))
    }
        output = csvLines.join('\n')
        break
      }
      case 'sql': {
        if (result.rows.length === 0) {
          output = `-- No data in ${table}\n`
          break
        }
        const columns = Object.keys(result.rows[0])
        const lines = result.rows.map((row: any) => {
          const values = columns.map(c => {
            let v = row[c]
            if (v === null || v === undefined) return 'NULL'
            if (v instanceof Date) return `'${v.toISOString().replace('T', ' ').replace('Z', '')}'`
            if (typeof v === 'number') return String(v)
            return `'${String(v).replace(/'/g, "\\'")}'`
          })
          return `INSERT INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});`
        })
        output = lines.join('\n') + '\n'
        break
      }
      default:
        return formatError('export', { code: 'ER_INVALID_FORMAT', message: `Unsupported format: ${format}` })
    }

    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf-8')
      return formatSuccess({
        command: 'export',
        table,
        format,
        outputFile: options.output,
        rows: result.rows.length,
      })
    }

    process.stdout.write(output)
    return ''
  } catch (err: any) {
    return formatError('export', err)
  }
}

export async function importCommand(
  conn: Connection,
  file: string,
  options: { table?: string; format?: string }
): Promise<string> {
  try {
    if (!fs.existsSync(file)) {
      return formatError('import', { code: 'ER_FILE_NOT_FOUND', message: `File not found: ${file}` })
    }

    const content = fs.readFileSync(file, 'utf-8').trim()
    if (!content) {
      return formatError('import', { code: 'ER_EMPTY_FILE', message: 'File is empty' })
    }

    const format = options.format === 'auto' ? detectFormat(file, content) : options.format
    let result

    switch (format) {
      case 'json': {
        const data = JSON.parse(content)
        const table = options.table || pathBasename(file)
        if (!table) {
          return formatError('import', { code: 'ER_MISSING_TABLE', message: 'Could not determine table name. Use --table' })
        }
        return await insertJSON(conn, table, data)
      }
      case 'csv': {
        const table = options.table || pathBasename(file)
        if (!table) {
          return formatError('import', { code: 'ER_MISSING_TABLE', message: 'Could not determine table name. Use --table' })
        }
        return await insertCSV(conn, table, content)
      }
      case 'sql': {
        const statements = content
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('#'))
        let totalAffected = 0
        for (const stmt of statements) {
          const r = await executeSQL(conn, stmt)
          totalAffected += r.affectedRows || 0
        }
        return formatSuccess({
          command: 'import',
          format: 'sql',
          file,
          affectedRows: totalAffected,
          statements: statements.length,
        })
      }
      default:
        return formatError('import', { code: 'ER_INVALID_FORMAT', message: `Unsupported format: ${format}` })
    }
  } catch (err: any) {
    return formatError('import', err)
  }
}

function detectFormat(file: string, _content: string): string {
  if (file.endsWith('.json')) return 'json'
  if (file.endsWith('.csv')) return 'csv'
  if (file.endsWith('.sql')) return 'sql'
  return 'sql'
}

function pathBasename(file: string): string | null {
  const name = file.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '')
  return name || null
}

async function insertJSON(conn: Connection, table: string, data: any): Promise<string> {
  const rows = Array.isArray(data) ? data : [data]
  if (rows.length === 0) {
    return formatError('import', { code: 'ER_EMPTY_DATA', message: 'No data to import' })
  }

  const columns = Object.keys(rows[0])
  const placeholders = columns.map(() => '?').join(', ')
  const colList = columns.map(c => `\`${c}\``).join(', ')
  const sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`

  let totalAffected = 0
  for (const row of rows) {
    const values = columns.map(c => row[c])
    const r = await executeSQL(conn, sql, values)
    totalAffected += r.affectedRows || 0
  }

  return formatSuccess({ command: 'import', format: 'json', table, affectedRows: totalAffected })
}

async function insertCSV(conn: Connection, table: string, content: string): Promise<string> {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) {
    return formatError('import', { code: 'ER_EMPTY_CSV', message: 'CSV must have at least a header row and one data row' })
  }

  const headers = parseCSVLine(lines[0])
  const colList = headers.map(h => `\`${h}\``).join(', ')
  const placeholders = headers.map(() => '?').join(', ')
  const sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`

  let totalAffected = 0
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const r = await executeSQL(conn, sql, values)
    totalAffected += r.affectedRows || 0
  }

  return formatSuccess({ command: 'import', format: 'csv', table, affectedRows: totalAffected })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}
