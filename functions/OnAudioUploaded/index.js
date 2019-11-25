const Main = require('./main')
const envalid = require('envalid')
const process = require('process')

/**
 * @typedef {import('../types').AzureFunctionsContext} AzureFunctionsContext
 */

/**
 * @param {AzureFunctionsContext} context
 */
module.exports = async function (context) {
  const env = envalid.cleanEnv(process.env, {
    AUDIO_STORAGE: envalid.str(),
    SPEECH_SERVICE_KEY: envalid.str(),
    SPEECH_SERVICE_ENDPOINT: envalid.str()
  })

  const main = new Main({
    storageConnectionString: env.AUDIO_STORAGE,
    speechServiceKey: env.SPEECH_SERVICE_KEY,
    speechServiceEndpoint: env.SPEECH_SERVICE_ENDPOINT,
    log: context.log
  })

  const input = { event: context.bindings.eventGridEvent }

  const output = await main.run(input)

  context.bindings.outputQueueItem = [JSON.stringify(output)]
}
