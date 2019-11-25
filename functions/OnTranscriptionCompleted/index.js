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
    TRANSCRIPTION_CONTAINER: envalid.str(),
    SPEECH_SERVICE_KEY: envalid.str()
  })

  const main = new Main({
    storageConnectionString: env.AUDIO_STORAGE,
    transcriptionContainer: env.TRANSCRIPTION_CONTAINER,
    speechServiceKey: env.SPEECH_SERVICE_KEY,
    log: context.log
  })

  const input = context.bindings.queueItem

  await main.run(input)
}
