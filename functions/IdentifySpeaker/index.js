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
    SPEAKER_RECOGNITION_KEY: envalid.str(),
    SPEAKER_RECOGNITION_ENDPOINT: envalid.str()
  })

  const main = new Main({
    storageConnectionString: env.AUDIO_STORAGE,
    speakerRecognitionKey: env.SPEAKER_RECOGNITION_KEY,
    speakerRecognitionEndpoint: env.SPEAKER_RECOGNITION_ENDPOINT,
    log: context.log
  })

  const input = { event: context.bindings.eventGridEvent }

  const outputs = await main.run(input)

  context.bindings.outputQueueItem = outputs.map(output => JSON.stringify(output))
}
