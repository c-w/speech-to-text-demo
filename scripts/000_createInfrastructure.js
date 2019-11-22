#!/usr/bin/env node

const cmd = require('node-cmd')
const fs = require('fs')
const hasbin = require('hasbin')
const path = require('path')
const promisify = require('util').promisify
const semver = require('semver')

const get = promisify(cmd.get)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

const tagName = 'sttdeployment'
const location = 'EastUS'
const storageAccountSKU = 'Standard_LRS'
const audioContainerName = 'audio'
const transcriptionContainerName = 'transcription'
const webAppSKU = 'S1'
const webAppWorkers = 1
const functionAppSKU = 'EP1'
const functionAppMinWorkers = 1
const functionAppMaxWorkers = 20
const cognitiveServicesSKU = 'S0'

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
  const version = azVersionStdout.match(/azure-cli\s+(?<version>[0-9.]+)/m).groups.version
  const azMinVersion = '2.0.76'
  if (semver.lt(version, azMinVersion)) {
    console.error(`The version of the az utility must be ${azMinVersion} or higher.`)
    process.exit(1)
  }

  if (!hasbin.sync('func')) {
    console.error('The func utility is required for this script: https://www.npmjs.com/package/azure-functions-core-tools.')
    process.exit(1)
  }

  try {
    await get(`az account show -s ${subscriptionId}`)
  } catch (err) {
    console.error(`Must run 'az login' and 'az account set -s ${subscriptionId}' before calling this script.`)
    process.exit(1)
  }

  const listGroupsStdout = await get(`az group list --tag "${tagName}=${prefix}" -o json`)
  const deploymentExists = JSON.parse(listGroupsStdout).length > 0

  if (deploymentExists) {
    console.error(`Deployment with prefix ${prefix} already exists.`)
    process.exit(1)
  }

  return { subscriptionId, prefix }
}

function createName (prefix, resourceType) {
  return `${prefix}${resourceType}`.substr(0, 63)
}

async function createResourceGroups ({ prefix }) {
  const resourceGroupNames = ['minio', 'svc'].map(suffix => `${prefix}${suffix}`)

  await Promise.all(resourceGroupNames.map(async name => {
    console.log(`Creating Resource Group ${name} with location=${location}.`)
    await get(`az group create -n "${name}" -l "${location}" --tags "${tagName}=${prefix}"`)
  }))

  return resourceGroupNames
}

async function createStorageAccount ({ prefix, resourceGroup }) {
  const name = createName(prefix, 'data').substr(0, 24)

  console.log(`Creating Storage Account ${name} with SKU=${storageAccountSKU}.`)

  await get(`az storage account create -n "${name}" -g "${resourceGroup}" -l "${location}" --kind StorageV2 --sku "${storageAccountSKU}"`)
  const createAccountStdout = await get(`az storage account show-connection-string -n ${name} -o json`)

  const storageConnectionString = JSON.parse(createAccountStdout).connectionString
  await get(`az storage container create -n "${audioContainerName}" --connection-string "${storageConnectionString}"`)
  await get(`az storage container create -n "${transcriptionContainerName}" --connection-string "${storageConnectionString}"`)

  const storageConnectionStringParts = storageConnectionString.split(';').map(kv => kv.split('='))
  const storageAccountName = storageConnectionStringParts.filter(kv => kv[0] === 'AccountName')[0].slice(1).join('=')
  const storageAccountKey = storageConnectionStringParts.filter(kv => kv[0] === 'AccountKey')[0].slice(1).join('=')
  return { storageConnectionString, storageAccountName, storageAccountKey }
}

async function createMinioWebApp ({ prefix, resourceGroup, storageAccountName, storageAccountKey }) {
  const name = createName(prefix, 'minio')

  console.log(`Creating Web App ${name} with SKU=${webAppSKU} and workers=${webAppWorkers}.`)

  await get(`az appservice plan create -n "${name}" -g "${resourceGroup}" -l "${location}" --is-linux --sku "${webAppSKU}" --number-of-workers "${webAppWorkers}"`)
  const createWebAppStdout = await get(`az webapp create -n "${name}" -g "${resourceGroup}" -p "${name}" -i "cwolff/minio:latest" -o json --startup-file "minio gateway azure"`)
  await get(`az webapp log config -n "${name}" -g "${resourceGroup}" --web-server-logging filesystem`)
  await get(`az webapp config appsettings set -n "${name}" -g "${resourceGroup}" --settings WEBSITES_PORT=9000 MINIO_ACCESS_KEY="${storageAccountName}" MINIO_SECRET_KEY="${storageAccountKey}"`)
  await get(`az webapp restart -n "${name}" -g "${resourceGroup}"`)

  const minioEndpoint = `https://${JSON.parse(createWebAppStdout).defaultHostName}`
  return { minioEndpoint }
}

async function createCognitiveServices ({ prefix, resourceGroup }) {
  const name = createName(prefix, 'stt')

  console.log(`Creating Cognitive Services ${name} with SKU=${cognitiveServicesSKU}.`)

  await get(`az cognitiveservices account create -n "${name}" -g "${resourceGroup}" -l "${location}" --kind SpeechServices --sku "${cognitiveServicesSKU}" --yes`)
  const listKeysStdout = await get(`az cognitiveservices account keys list -n "${name}" -g "${resourceGroup}" -o json`)

  const crisEndpoint = `https://${location.toLowerCase()}.cris.ai`
  const crisAccessKey = JSON.parse(listKeysStdout).key1
  return { crisEndpoint, crisAccessKey }
}

async function createFunctionApp ({ prefix, subscriptionId, resourceGroup, storageAccountName }) {
  const name = createName(prefix, 'func')

  console.log(`Creating Function App ${name} with SKU=${functionAppSKU}, minWorkers=${functionAppMinWorkers} and maxWorkers=${functionAppMaxWorkers}.`)

  await get(`az functionapp plan create -n "${name}" -g "${resourceGroup}" -l "${location}" --sku "${functionAppSKU}" --number-of-workers "${functionAppMinWorkers}" --max-burst "${functionAppMaxWorkers}"`)

  const createFunctionAppStdout = await get(`az functionapp create -n "${name}" -g "${resourceGroup}" -p "${name}" -s "${storageAccountName}" --runtime node`)

  const functionAppId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/sites/${name}`
  let listKeysStdout = null
  while (listKeysStdout == null) {
    try {
      listKeysStdout = await get(`az rest --method post --uri "${functionAppId}/host/default/listKeys?api-version=2018-11-01" -o json`)
    } catch (err) {
      console.error(`Temporary issue reaching resource ${functionAppId}, retrying: ${err}.`)
    }
  }

  const functionsEndpoint = `https://${JSON.parse(createFunctionAppStdout).defaultHostName}`
  const functionsMasterKey = JSON.parse(listKeysStdout).masterKey
  return { functionsName: name, functionsEndpoint, functionsMasterKey }
}

async function deployFunctionApp ({ functionsName }) {
  console.log('Deploying Function App.')

  let publishStdout = null
  while (publishStdout == null) {
    try {
      publishStdout = await get(`func azure functionapp publish "${functionsName}" -i -y`)
    } catch (err) {
      console.error(`Temporary issue publishing to ${functionsName}, retrying: ${err}.`)
    }
  }
}

async function writeConfigFiles (configValues) {
  await Promise.all(['.env.template', 'local.settings.json.template'].map(async configTemplateName => {
    console.log(`Populating config file template ${configTemplateName}.`)

    const configTemplatePath = path.join(__dirname, '..', configTemplateName)
    let config = await readFile(configTemplatePath, { encoding: 'utf-8' })

    Object.entries(configValues).forEach(([key, value]) => {
      config = config.split('${' + key + '}').join(value)
    })

    const configPath = path.join(__dirname, '..', configTemplateName.replace('.template', ''))
    await writeFile(configPath, config, { encoding: 'utf-8' })
  }))
}

async function createEventGridRegistration ({ prefix, subscriptionId, resourceGroup, storageAccountName, functionsEndpoint, functionsMasterKey }) {
  const name = createName(prefix, 'sub')

  console.log(`Creating EventGrid subscription ${name} between Function App and Storage Account.`)

  await get(`az eventgrid event-subscription create -n "${name}" --source-resource-id "/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageaccounts/${storageAccountName}" --included-event-types Microsoft.Storage.BlobCreated --subject-begins-with "/blobServices/default/containers/${audioContainerName}/blobs/" --endpoint "${functionsEndpoint}/runtime/webhooks/eventgrid?functionName=OnAudioUploaded&code=${functionsMasterKey}"`)
}

async function main () {
  const args = await ensureDependenciesAreMet()
  const [minioResourceGroup, resourceGroup] = await createResourceGroups({ ...args })

  const [storage, cris] = await Promise.all([
    createStorageAccount({ resourceGroup, ...args }),
    createCognitiveServices({ resourceGroup, ...args })
  ])

  const [minio, functions] = await Promise.all([
    createMinioWebApp({ resourceGroup: minioResourceGroup, ...storage, ...args }),
    createFunctionApp({ resourceGroup, ...storage, ...args })
  ])

  await writeConfigFiles({
    audioContainerName,
    transcriptionContainerName,
    ...storage,
    ...minio,
    ...cris
  })

  await deployFunctionApp({ ...functions })
  await createEventGridRegistration({ resourceGroup, ...storage, ...functions, ...args })
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
