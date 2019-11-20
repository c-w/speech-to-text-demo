const Main = require('./main')
const process = require('process')

module.exports = async function (context) {
  const main = new Main({
    storageConnectionString: process.env.AUDIO_STORAGE,
    transcriptionContainer: process.env.TRANSCRIPTION_CONTAINER,
    speechServiceKey: process.env.SPEECH_SERVICE_KEY,
    log: context.log
  })

  const input = context.bindings.queueItem

  await main.run(input)
}
