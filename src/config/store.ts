import * as fs from 'fs'
import * as path from 'path'
import { ConfigStore, ConfigProfile } from '../types'

const CONFIG_DIR = path.join(process.cwd(), '.agent-mysql')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readConfig(): ConfigStore {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(raw)
    }
  } catch {}
  return { profiles: {} }
}

function writeConfig(config: ConfigStore): void {
  ensureConfigDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

export function getProfile(name: string): ConfigProfile | null {
  const config = readConfig()
  return config.profiles[name] || null
}

export function setProfile(name: string, profile: ConfigProfile): void {
  const config = readConfig()
  config.profiles[name] = profile
  if (!config.default) config.default = name
  writeConfig(config)
}

export function removeProfile(name: string): boolean {
  const config = readConfig()
  if (!config.profiles[name]) return false
  delete config.profiles[name]
  if (config.default === name) {
    const keys = Object.keys(config.profiles)
    config.default = keys.length > 0 ? keys[0] : undefined
  }
  writeConfig(config)
  return true
}

export function listProfiles(): { name: string; profile: ConfigProfile; isDefault: boolean }[] {
  const config = readConfig()
  return Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    profile,
    isDefault: config.default === name,
  }))
}

export function setDefaultProfile(name: string): boolean {
  const config = readConfig()
  if (!config.profiles[name]) return false
  config.default = name
  writeConfig(config)
  return true
}

export function getDefaultProfile(): ConfigProfile | null {
  const config = readConfig()
  if (config.default) {
    return config.profiles[config.default] || null
  }
  return null
}

export function getAllConfig(): ConfigStore {
  return readConfig()
}
