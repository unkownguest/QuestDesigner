#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.join(__dirname, '..')
const packageJsonPath = path.join(root, 'package.json')

function runCommand(command, args) {
  const commandLabel = `${command} ${args.join(' ')}`
  console.log(`$ ${commandLabel}`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })

  if (result.error) {
    throw new Error(`Failed to run "${commandLabel}": ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`Command failed with status ${result.status}: ${commandLabel}`)
  }
}

function runInstallCommand(label, commands) {
  try {
    runCommand(commands[0], commands.slice(1))
  } catch (error) {
    console.log(`warn: ${label} failed, trying fallback`)
    if (commands[0] !== 'npm') {
      throw error
    }
    runCommand('npm', ['install', '--no-audit', '--no-fund'])
  }
}

function ensureFileFromExample(examplePath, targetPath) {
  if (fs.existsSync(targetPath)) {
    console.log(`skip: ${path.relative(root, targetPath)} already exists`)
    return
  }

  if (!fs.existsSync(examplePath)) {
    console.log(`warn: missing example file ${path.relative(root, examplePath)}; generating minimal template`)
    fs.writeFileSync(examplePath, '', 'utf8')
  }

  fs.copyFileSync(examplePath, targetPath)
  console.log(`created: ${path.relative(root, targetPath)} from ${path.relative(root, examplePath)}`)
}

function detectPackageManager() {
  const lockfiles = [
    { file: 'package-lock.json', command: 'npm' },
    { file: 'yarn.lock', command: 'yarn' },
    { file: 'pnpm-lock.yaml', command: 'pnpm' },
  ]

  for (const candidate of lockfiles) {
    if (fs.existsSync(path.join(root, candidate.file))) {
      return candidate.command
    }
  }

  return 'npm'
}

function hasScript(name) {
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8')
    const pkg = JSON.parse(raw)
    return Boolean(pkg.scripts && typeof pkg.scripts[name] === 'string')
  } catch {
    return false
  }
}

function main() {
  const packageManager = detectPackageManager()
  console.log(`Detected package manager: ${packageManager}`)
  const buildRunner = packageManager === 'yarn' ? 'yarn' : packageManager === 'pnpm' ? 'pnpm' : 'npm'

  switch (packageManager) {
    case 'npm':
      runInstallCommand('npm ci', ['npm', 'ci', '--no-audit', '--no-fund'])
      break
    case 'yarn':
      runCommand('yarn', ['install', '--immutable'])
      break
    case 'pnpm':
      runCommand('pnpm', ['install', '--frozen-lockfile'])
      break
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`)
  }

  ensureFileFromExample(path.join(root, '.env.example'), path.join(root, '.env.local'))
  ensureFileFromExample(path.join(root, 'api', '.env.example'), path.join(root, 'api', '.env.local'))

  if (hasScript('build')) {
    runCommand(buildRunner, ['run', 'build'])
  } else {
    console.log('skip: build script not defined in package.json')
  }

  console.log('Worktree setup complete.')
}

main()
