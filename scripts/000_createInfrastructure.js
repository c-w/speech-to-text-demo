#!/usr/bin/env node

const cmd = require('node-cmd')
const fs = require('fs')
const hasbin = require('hasbin')
const path = require('path')
const promisify = require('util').promisify
const semver = require('semver')
const temp = require('temp')
const zipper = require('zip-local')

const get = promisify(cmd.get)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

const azMinVersion = '2.0.76'
const terraformMinVersion = '0.12.16'

async function ensureDependenciesAreMet () {
  if (process.argv.length !== 4) {
    console.error(`Usage: node ${process.argv[1]} <subscriptionId> <resourcePrefix>`)
    process.exit(1)
  }

  const subscriptionId = process.argv[2]
  const prefix = process.argv[3]

  if (!hasbin.sync('az')) {
    console.error('The az utility is required for this script: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli.')
    process.exit(1)
  }

  const azVersionStdout = await get('az --version')
  const azVersion = azVersionStdout.match(/azure-cli\s+(?<version>[0-9.]+)/m).groups.version
  if (semver.lt(azVersion, azMinVersion)) {
    console.error(`The version of the az utility must be ${azMinVersion} or higher.`)
    process.exit(1)
  }

  if (!hasbin.sync('terraform')) {
    console.error('The terraform utility is required for this script: https://www.terraform.io/downloads.html.')
    process.exit(1)
  }

  const terraformVersionStdout = await get('terraform --version')
  const terraformVersion = terraformVersionStdout.match(/Terraform v(?<version>[0-9.]+)/).groups.version
  if (semver.lt(terraformVersion, terraformMinVersion)) {
    console.error(`The version of the terraform utility must be ${terraformMinVersion} or higher.`)
    process.exit(1)
  }

  try {
    await get(`az account show -s "${subscriptionId}"`)
  } catch (err) {
    console.error(`Must run 'az login' before calling this script.`)
    process.exit(1)
  }

  return { subscriptionId, prefix }
}

async function withDir (directory, context) {
  const currentDirectory = process.cwd()
  process.chdir(directory)
  const result = await context()
  process.chdir(currentDirectory)
  return result
}

async function packageCode () {
  const codeZipPath = temp.path({ suffix: '.zip' })
  const codeDirectory = path.join(__dirname, '..', 'functions')

  console.log(`Installing dependencies for ${codeDirectory}.`)
  await withDir(codeDirectory, () => get('npm install --only=prod'))

  console.log(`Packaging code to ${codeZipPath}.`)
  zipper.sync.zip(codeDirectory).compress().save(codeZipPath)

  return codeZipPath
}

async function deployTerraform ({ codeZip, subscriptionId, prefix }) {
  const terraformDirectory = path.join(__dirname, '..', 'infrastructure')

  console.log(`Applying terraform resources from ${terraformDirectory}.`)
  return await withDir(terraformDirectory, async () => {
    await get(`terraform apply -auto-approve -var "prefix=${prefix}" -var "subscription_id=${subscriptionId}" -var "code_zip=${codeZip}"`)

    const terraformOutputStdout = await get(`terraform output -json -no-color`)
    return JSON.parse(terraformOutputStdout)
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
  const args = await ensureDependenciesAreMet()

  const codeZip = await packageCode()
  const terraformOutput = await deployTerraform({ codeZip, ...args })

  await writeConfigFiles(terraformOutput)
}

main()
  .then(() => {
    console.log('Created all infrastructure.')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
