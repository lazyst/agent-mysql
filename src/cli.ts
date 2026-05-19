import { Command } from 'commander'
import { createConnection } from './core/connection'
import { getProfile, getDefaultProfile } from './config/store'
import { parseDSN } from './utils/dsn-parser'
import { ConnectionOptions } from './types'
import { queryCommand } from './commands/query'
import { databasesCommand, tablesCommand, descCommand, schemaCommand } from './commands/metadata'
import { statusCommand } from './commands/status'
import { insertCommand, updateCommand, deleteCommand } from './commands/dml'
import { exportCommand, importCommand } from './commands/import-export'
import {
  configGetCommand,
  configSetCommand,
  configListCommand,
  configRemoveCommand,
  configUseCommand,
  configTestCommand,
} from './commands/config-cmd'

const program = new Command()

program
  .name('agent-mysql')
  .description('MySQL CLI tool designed for AI Agents')
  .version('1.0.0')
  .option('-h, --host <host>', 'MySQL host', 'localhost')
  .option('-P, --port <port>', 'MySQL port', '3306')
  .option('-u, --user <user>', 'MySQL user')
  .option('-p, --password <password>', 'MySQL password')
  .option('-d, --database <database>', 'MySQL database')
  .option('--dsn <dsn>', 'MySQL connection string (mysql://user:pass@host:port/db)')
  .option('--use <profile>', 'Use saved connection profile')

function resolveOptions(cmd: Command): ConnectionOptions {
  const opts = cmd.optsWithGlobals()

  if (opts.dsn) {
    const parsed = parseDSN(opts.dsn)
    if (parsed) return parsed
    console.error(JSON.stringify({ success: false, error: { code: 'ER_INVALID_DSN', message: `Invalid DSN: ${opts.dsn}` }, command: 'connect' }))
    process.exit(1)
  }

  if (opts.use) {
    const profile = getProfile(opts.use)
    if (!profile) {
      console.error(JSON.stringify({ success: false, error: { code: 'ER_PROFILE_NOT_FOUND', message: `Profile '${opts.use}' not found` }, command: 'connect' }))
      process.exit(1)
    }
    if (opts.database) profile.database = opts.database
    // Allow CLI flags to override profile fields when explicitly passed
    if (cmd.getOptionValueSource?.('host') === 'cli') profile.host = opts.host
    if (cmd.getOptionValueSource?.('port') === 'cli') profile.port = parseInt(opts.port, 10)
    if (cmd.getOptionValueSource?.('user') === 'cli') profile.user = opts.user
    if (cmd.getOptionValueSource?.('password') === 'cli') profile.password = opts.password
    return profile
  }

  if (opts.user || opts.password) {
    return {
      host: opts.host,
      port: parseInt(opts.port, 10),
      user: opts.user || 'root',
      password: opts.password || '',
      database: opts.database,
    }
  }

  const defaultProfile = getDefaultProfile()
  if (defaultProfile) {
    const profile = { ...defaultProfile }
    if (opts.database) profile.database = opts.database
    return profile
  }

  console.error(JSON.stringify({ success: false, error: { code: 'ER_NO_CONNECTION', message: 'No connection info provided. Use -h/-u/-p, --dsn, --use <profile>, or save a default profile via "config set"' }, command: 'connect' }))
  process.exit(1)
}

async function withConnection<T>(cmd: Command, fn: (conn: any) => Promise<T>): Promise<T> {
  const opts = resolveOptions(cmd)
  const conn = await createConnection(opts)
  try {
    return await fn(conn)
  } finally {
    await conn.end().catch(() => {})
  }
}

async function run(cmd: Command, fn: (conn: any) => Promise<string>) {
  try {
    const result = await withConnection(cmd, fn)
    if (result) process.stdout.write(result + '\n')
  } catch (err: any) {
    process.stdout.write(JSON.stringify({ success: false, error: { code: 'ER_EXECUTION', message: err.message }, command: 'execute' }) + '\n')
    process.exit(1)
  }
}

program
  .command('query')
  .description('Execute SQL query')
  .argument('<sql>', 'SQL statement')
  .option('--params <json>', 'Query parameters as JSON array')
  .option('--limit <number>', 'Max rows for SELECT', '200')
  .option('--offset <number>', 'Offset for SELECT')
  .option('--force', 'Allow destructive operations (DROP/TRUNCATE/ALTER/DELETE without WHERE)')
  .action((sql, options) => {
    let params: any[] | undefined
    if (options.params) {
      try { params = JSON.parse(options.params) } catch {
        process.stdout.write(JSON.stringify({ success: false, error: { code: 'ER_INVALID_JSON', message: `Invalid --params: ${options.params}` }, command: 'query' }) + '\n')
        process.exit(1)
        return
      }
    }
    run(program, (conn) =>
      queryCommand(conn, sql, {
        params,
        limit: parseInt(options.limit, 10),
        offset: options.offset ? parseInt(options.offset, 10) : undefined,
        force: !!options.force,
      })
    )
  })

program
  .command('databases')
  .description('List all databases')
  .action(() => run(program, databasesCommand))

program
  .command('tables')
  .description('List tables in database')
  .option('--database <db>', 'Database name')
  .action((options) => run(program, (conn) => tablesCommand(conn, options.database)))

program
  .command('desc')
  .description('Describe table structure (columns + indexes)')
  .argument('<table>', 'Table name')
  .action((table) => run(program, (conn) => descCommand(conn, table)))

program
  .command('schema')
  .description('Show CREATE TABLE statement')
  .argument('<table>', 'Table name')
  .action((table) => run(program, (conn) => schemaCommand(conn, table)))

program
  .command('status')
  .description('Show connection status')
  .option('--all', 'Show all info including size, variables, slow queries')
  .action((options) => run(program, (conn) => statusCommand(conn, !!options.all)))

program
  .command('insert')
  .description('Insert data into table')
  .argument('<table>', 'Table name')
  .requiredOption('--data <json>', 'Data as JSON object or array')
  .option('--upsert', 'Use INSERT ON DUPLICATE KEY UPDATE')
  .option('--keys <json>', 'Unique key columns as JSON array (for upsert)')
  .action((table, options) => {
    let data: any
    try { data = JSON.parse(options.data) } catch {
      process.stdout.write(JSON.stringify({ success: false, error: { code: 'ER_INVALID_JSON', message: `Invalid --data: ${options.data}` }, command: 'insert' }) + '\n')
      process.exit(1)
      return
    }
    let keys: string[] | undefined
    if (options.keys) {
      try { keys = JSON.parse(options.keys) } catch {
        process.stdout.write(JSON.stringify({ success: false, error: { code: 'ER_INVALID_JSON', message: `Invalid --keys: ${options.keys}` }, command: 'insert' }) + '\n')
        process.exit(1)
        return
      }
    }
    run(program, (conn) =>
      insertCommand(conn, table, data, !!options.upsert, keys)
    )
  })

program
  .command('update')
  .description('Update data in table')
  .argument('<table>', 'Table name')
  .requiredOption('--set <json>', 'SET clause as JSON object')
  .option('--where <sql>', 'WHERE clause (required)')
  .option('--force', 'Allow full table update with --where "1=1"')
  .action((table, options) => {
    if (!options.where) {
      process.stdout.write(JSON.stringify({ success: false, error: { code: 'ER_MISSING_WHERE', message: '--where is required for UPDATE' }, command: 'update' }) + '\n')
      process.exit(1)
      return
    }
    let setData: any
    try { setData = JSON.parse(options.set) } catch {
      process.stdout.write(JSON.stringify({ success: false, error: { code: 'ER_INVALID_JSON', message: `Invalid --set: ${options.set}` }, command: 'update' }) + '\n')
      process.exit(1)
      return
    }
    run(program, (conn) =>
      updateCommand(conn, table, setData, options.where, !!options.force)
    )
  })

program
  .command('delete')
  .description('Delete data from table')
  .argument('<table>', 'Table name')
  .option('--where <sql>', 'WHERE clause (required)')
  .option('--force', 'Allow full table delete with --where "1=1"')
  .action((table, options) => {
    if (!options.where) {
      process.stdout.write(JSON.stringify({ success: false, error: { code: 'ER_MISSING_WHERE', message: '--where is required for DELETE' }, command: 'delete' }) + '\n')
      process.exit(1)
      return
    }
    run(program, (conn) =>
      deleteCommand(conn, table, options.where, !!options.force)
    )
  })

program
  .command('export')
  .description('Export table data')
  .argument('<table>', 'Table name')
  .option('--format <type>', 'Export format: json, csv, sql', 'json')
  .option('--output <file>', 'Output file path')
  .option('--where <sql>', 'WHERE clause')
  .option('--limit <number>', 'Max rows')
  .action((table, options) =>
    run(program, (conn) =>
      exportCommand(conn, table, {
        format: options.format,
        output: options.output,
        where: options.where,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
      })
    )
  )

program
  .command('import')
  .description('Import data from file')
  .argument('<file>', 'File path')
  .option('--table <name>', 'Table name (auto-detected from filename if omitted)')
  .option('--format <type>', 'File format: auto, json, csv, sql', 'auto')
  .action((file, options) =>
    run(program, (conn) =>
      importCommand(conn, file, { table: options.table, format: options.format })
    )
  )

const configCmd = program
  .command('config')
  .description('Manage connection profiles')

configCmd
  .command('set')
  .description('Set config value (format: <profile>.<field> <value>)')
  .argument('<key>', 'Config key (e.g. prod.host)')
  .argument('<value>', 'Config value')
  .action((key, value) => {
    process.stdout.write(configSetCommand(key, value) + '\n')
  })

configCmd
  .command('get')
  .description('Get config value')
  .argument('[key]', 'Config key or profile name')
  .action((key) => {
    process.stdout.write(configGetCommand(key) + '\n')
  })

configCmd
  .command('list')
  .description('List all profiles')
  .action(() => {
    process.stdout.write(configListCommand() + '\n')
  })

configCmd
  .command('remove')
  .description('Remove a profile')
  .argument('<name>', 'Profile name')
  .action((name: string) => {
    process.stdout.write(configRemoveCommand(name) + '\n')
  })

configCmd
  .command('use')
  .description('Set default profile')
  .argument('<name>', 'Profile name')
  .action((name: string) => {
    process.stdout.write(configUseCommand(name) + '\n')
  })

configCmd
  .command('test')
  .description('Test a profile connection')
  .argument('<name>', 'Profile name')
  .action(async (name: string) => {
    const result = await configTestCommand(name)
    process.stdout.write(result + '\n')
  })

program.parse(process.argv)
