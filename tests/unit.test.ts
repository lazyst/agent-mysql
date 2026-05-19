import { describe, it, expect } from 'vitest'
import { isDestructive, isDangerousDML, validateSQL, isAlwaysTrueWhere } from '../src/core/error-handler'
import { parseDSN } from '../src/utils/dsn-parser'
import { escapeId } from '../src/core/formatter'

describe('error-handler', () => {
  it('detects destructive SQL', () => {
    expect(isDestructive('DROP TABLE users')).toBe(true)
    expect(isDestructive('TRUNCATE TABLE users')).toBe(true)
    expect(isDestructive('ALTER TABLE users ADD COLUMN x INT')).toBe(true)
    expect(isDestructive('SELECT * FROM users')).toBe(false)
    expect(isDestructive('INSERT INTO users VALUES (1)')).toBe(false)
  })

  it('detects dangerous DML without WHERE', () => {
    expect(isDangerousDML('DELETE FROM users')).toBe(true)
    expect(isDangerousDML("DELETE FROM users WHERE id=1")).toBe(false)
    expect(isDangerousDML('UPDATE users SET name="x"')).toBe(true)
    expect(isDangerousDML('UPDATE users SET name="x" WHERE id=1')).toBe(false)
  })

  it('validateSQL returns error for destructive without force', () => {
    expect(validateSQL('DROP TABLE users', false)).not.toBeNull()
    expect(validateSQL('DROP TABLE users', true)).toBeNull()
  })

  it('validateSQL returns null for safe SQL', () => {
    expect(validateSQL('SELECT * FROM users', false)).toBeNull()
    expect(validateSQL('INSERT INTO users VALUES (1)', false)).toBeNull()
  })

  it('detects dangerous DML with complex whitespace', () => {
    expect(isDangerousDML('\tDELETE  FROM  users')).toBe(true)
    expect(isDangerousDML('\nUPDATE  users  SET  name="x"')).toBe(true)
    expect(isDangerousDML('  DELETE FROM users WHERE id=1  ')).toBe(false)
  })
})

describe('isAlwaysTrueWhere', () => {
  it('detects literal 1=1', () => {
    expect(isAlwaysTrueWhere('1=1')).toBe(true)
    expect(isAlwaysTrueWhere('1 = 1')).toBe(true)
    expect(isAlwaysTrueWhere('  1=1  ')).toBe(true)
  })

  it('detects literal 1', () => {
    expect(isAlwaysTrueWhere('1')).toBe(true)
  })

  it('detects TRUE keyword', () => {
    expect(isAlwaysTrueWhere('TRUE')).toBe(true)
    expect(isAlwaysTrueWhere('true')).toBe(true)
  })

  it('detects 1=1 with SQL comments', () => {
    expect(isAlwaysTrueWhere('1=1 -- comment')).toBe(true)
    expect(isAlwaysTrueWhere('1=1 # comment')).toBe(true)
    expect(isAlwaysTrueWhere('1=1 /* block */')).toBe(true)
  })

  it('rejects false comparisons', () => {
    expect(isAlwaysTrueWhere('1=2')).toBe(false)
    expect(isAlwaysTrueWhere('2>3')).toBe(false)
    expect(isAlwaysTrueWhere('1<0')).toBe(false)
  })

  it('rejects real column conditions', () => {
    expect(isAlwaysTrueWhere('id = 1')).toBe(false)
    expect(isAlwaysTrueWhere('name = "alice"')).toBe(false)
    expect(isAlwaysTrueWhere('status > 0')).toBe(false)
  })

  it('empty after stripping comments is always true', () => {
    expect(isAlwaysTrueWhere('-- just a comment')).toBe(true)
    expect(isAlwaysTrueWhere('# another comment')).toBe(true)
  })
})

describe('escapeId', () => {
  it('wraps simple names in backticks', () => {
    expect(escapeId('users')).toBe('`users`')
    expect(escapeId('first_name')).toBe('`first_name`')
  })

  it('doubles internal backticks', () => {
    expect(escapeId('my`table')).toBe('`my``table`')
    expect(escapeId('a`b`c')).toBe('`a``b``c`')
  })
})

describe('dsn-parser', () => {
  it('parses valid DSN', () => {
    const result = parseDSN('mysql://root:pass123@localhost:3306/mydb')
    expect(result).toEqual({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'pass123',
      database: 'mydb',
    })
  })

  it('parses DSN without database', () => {
    const result = parseDSN('mysql://root:pass@host.com:3306')
    expect(result).toEqual({
      host: 'host.com',
      port: 3306,
      user: 'root',
      password: 'pass',
      database: undefined,
    })
  })

  it('returns null for invalid DSN', () => {
    expect(parseDSN('not-a-dsn')).toBeNull()
    expect(parseDSN('')).toBeNull()
  })

  it('parses DSN with @ in password', () => {
    const result = parseDSN('mysql://root:pass@word@localhost:3306/mydb')
    expect(result).toEqual({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'pass@word',
      database: 'mydb',
    })
  })

  it('parses DSN with special chars in database name', () => {
    const result = parseDSN('mysql://root:pass@localhost:3306/my-db_v2')
    expect(result).toEqual({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'pass',
      database: 'my-db_v2',
    })
  })

  it('parses DSN with no database and special chars in password', () => {
    const result = parseDSN('mysql://user:p@ss:w@rd@host.com:3306')
    expect(result).toEqual({
      host: 'host.com',
      port: 3306,
      user: 'user',
      password: 'p@ss:w@rd',
      database: undefined,
    })
  })

  it('parses DSN with IPv6 address', () => {
    const result = parseDSN('mysql://root:pass@[::1]:3306/mydb')
    expect(result).toEqual({
      host: '::1',
      port: 3306,
      user: 'root',
      password: 'pass',
      database: 'mydb',
    })
  })

  it('parses DSN with full IPv6 address', () => {
    const result = parseDSN('mysql://admin:secret@[2001:db8::1]:3307/test_db')
    expect(result).toEqual({
      host: '2001:db8::1',
      port: 3307,
      user: 'admin',
      password: 'secret',
      database: 'test_db',
    })
  })
})
