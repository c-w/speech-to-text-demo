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
    MONGODB_CONNECTION_STRING: envalid.str(),
    MONGODB_DATABASE: envalid.str(),
    TRANSCRIPTION_COLLECTION: envalid.str(),
    SPEECH_SERVICE_KEY: envalid.str()
  })

  const main = new Main({
    mongodbConnectionString: env.MONGODB_CONNECTION_STRING,
    mongodbDatabase: env.MONGODB_DATABASE,
    transcriptionCollection: env.TRANSCRIPTION_COLLECTION,
    speechServiceKey: env.SPEECH_SERVICE_KEY,
    log: context.log
  })

  const input = context.bindings.queueItem

  await main.run(input)
}
