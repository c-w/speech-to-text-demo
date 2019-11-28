#!/usr/bin/env node

const childProcess = require('child_process')
const fs = require('fs')
const hasbin = require('hasbin')
const path = require('path')
const promisify = require('util').promisify

const exec = promisify(childProcess.exec)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

async function ensureDependenciesAreMet () {
  if (!hasbin.sync('terraform')) {
    console.error('The terraform utility is required for this script: https://www.terraform.io/downloads.html.')
    process.exit(1)
  }
}

async function withDir (directory, context) {
  const currentDirectory = process.cwd()
  process.chdir(directory)
  const result = await context()
  process.chdir(currentDirectory)
  return result
}

async function loadTerraformOutput () {
  const terraformDirectory = path.join(__dirname, '..', 'infrastructure')

  return withDir(terraformDirectory, async () => {
    const terraformOutputProcess = await exec('terraform output -json -no-color')
    return JSON.parse(terraformOutputProcess.stdout)
  })
}

async function writeConfigFiles (terraformOutput) {
  await Promise.all(['.env.template', 'local.settings.json.template'].map(async configTemplateName => {
    console.log(`Populating config file template ${configTemplateName}.`)

    const configTemplatePath = path.join(__dirname, '..', configTemplateName)
    let config = await readFile(configTemplatePath, { encoding: 'utf-8' })

    Object.entries(terraformOutput).forEach(([key, output]) => {
      config = config.split('${' + key + '}').join(output.value)
    })

    const configPath = path.join(__dirname, '..', configTemplateName.replace('.template', ''))
    await writeFile(configPath, config, { encoding: 'utf-8' })
  }))
}

async function main () {
  await ensureDependenciesAreMet()

  const terraformOutput = await loadTerraformOutput()

  await writeConfigFiles(terraformOutput)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
