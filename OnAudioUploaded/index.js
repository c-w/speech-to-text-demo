const Main = require('./main')
const process = require('process')

module.exports = async function (context) {
  const main = new Main({
    storageAccountName: process.env.STORAGE_ACCOUNT_NAME,
    storageAccountKey: process.env.STORAGE_ACCOUNT_KEY,
    speechServiceKey: process.env.SPEECH_SERVICE_KEY,
    speechServiceEndpoint: process.env.SPEECH_SERVICE_ENDPOINT,
    log: context.log
  })

  await main.run({ event: context.bindings.eventGridEvent })
}
