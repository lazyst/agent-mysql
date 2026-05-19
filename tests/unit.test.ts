import { describe, it, expect } from 'vitest'
import { isDestructive, isDangerousDML, validateSQL } from '../src/core/error-handler'
import { parseDSN } from '../src/utils/dsn-parser'

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
})
