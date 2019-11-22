const Main = require('./main')
const process = require('process')

module.exports = async function (context) {
  const main = new Main({
    storageConnectionString: process.env.AUDIO_STORAGE,
    speechServiceKey: process.env.SPEECH_SERVICE_KEY,
    speechServiceEndpoint: process.env.SPEECH_SERVICE_ENDPOINT,
    log: context.log
  })

  const input = { event: context.bindings.eventGridEvent }

  const output = await main.run(input)

  context.bindings.outputQueueItem = [JSON.stringify(output)]
}
