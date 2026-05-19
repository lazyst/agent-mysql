import { formatSuccess, formatError } from '../core/formatter'
import { getAllConfig, setProfile, getProfile, removeProfile, listProfiles, setDefaultProfile } from '../config/store'
import { ConfigProfile } from '../types'

export function configGetCommand(key?: string): string {
  const config = getAllConfig()
  if (key) {
    if (key.includes('.')) {
      const [profile, field] = key.split('.')
      const p = getProfile(profile)
      if (!p) return formatError('config', { code: 'ER_PROFILE_NOT_FOUND', message: `Profile '${profile}' not found` })
      if (field) {
        const val = (p as any)[field]
        if (val === undefined) return formatError('config', { code: 'ER_FIELD_NOT_FOUND', message: `Field '${field}' not found in profile '${profile}'` })
        return JSON.stringify({ success: true, command: 'config', key, value: field === 'password' ? '***' : val })
      }
      const sanitized = { ...p, password: '***' }
      return JSON.stringify({ success: true, command: 'config', profile, ...sanitized })
    }
    const result: Record<string, unknown> = {}
    if (config.profiles[key]) {
      result.profile = { ...config.profiles[key], password: '***' }
    } else {
      return formatError('config', { code: 'ER_NOT_FOUND', message: `Key '${key}' not found` })
    }
    return JSON.stringify({ success: true, command: 'config', ...result })
  }
  return JSON.stringify({
    success: true,
    command: 'config',
    default: config.default || null,
    profiles: Object.fromEntries(
      Object.entries(config.profiles).map(([k, v]) => [k, { ...v, password: '***' }])
    ),
  })
}

export function configSetCommand(key: string, value: string): string {
  const parts = key.split('.')
  if (parts.length === 2) {
    const [profile, field] = parts
    const existing = getProfile(profile) || { host: 'localhost', port: 3306, user: 'root', password: '' }
    if (field === 'port') {
      (existing as any)[field] = parseInt(value, 10)
    } else {
      (existing as any)[field] = value
    }
    setProfile(profile, existing)
    return formatSuccess({ command: 'config', action: 'set', key, value: field === 'password' ? '***' : value })
  }
  return formatError('config', { code: 'ER_INVALID_KEY', message: 'Key must be in format: <profile>.<field>' })
}

export function configListCommand(): string {
  const profiles = listProfiles()
  return JSON.stringify({
    success: true,
    command: 'config',
    action: 'list',
    profiles: profiles.map(p => ({
      name: p.name,
      isDefault: p.isDefault,
      ...p.profile,
      password: '***',
    })),
  })
}

export function configRemoveCommand(key: string): string {
  const ok = removeProfile(key)
  if (!ok) {
    return formatError('config', { code: 'ER_PROFILE_NOT_FOUND', message: `Profile '${key}' not found` })
  }
  return formatSuccess({ command: 'config', action: 'remove', profile: key })
}

export function configUseCommand(name: string): string {
  const ok = setDefaultProfile(name)
  if (!ok) {
    return formatError('config', { code: 'ER_PROFILE_NOT_FOUND', message: `Profile '${name}' not found` })
  }
  return formatSuccess({ command: 'config', action: 'use', profile: name })
}

export async function configTestCommand(name: string): Promise<string> {
  const profile = getProfile(name)
  if (!profile) {
    return formatError('config', { code: 'ER_PROFILE_NOT_FOUND', message: `Profile '${name}' not found` })
  }
  const { testConnection } = await import('../core/connection')
  const result = await testConnection(profile)
  if (result.ok) {
    return formatSuccess({
      command: 'config',
      action: 'test',
      profile: name,
      ok: true,
      version: result.version,
    })
  }
  return formatSuccess({
    command: 'config',
    action: 'test',
    profile: name,
    ok: false,
    error: result.error,
  })
}
