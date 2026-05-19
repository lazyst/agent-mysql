#!/usr/bin/env node
import('./cli.js').catch(err => {
  process.stderr.write(JSON.stringify({ success: false, error: { code: 'ER_BOOT', message: err.message } }) + '\n')
  process.exit(1)
})
