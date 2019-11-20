const azureStorage = require('@azure/storage-blob')
const got = require('got')

const POLLING_INTERVAL_SECONDS = 5

function sleepForSeconds (seconds) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, seconds * 1000)
  })
}

class Main {
  constructor ({ log, storageConnectionString, transcriptionContainer, speechServiceKey }) {
    this.log = log
    this.blobServiceClient = azureStorage.BlobServiceClient.fromConnectionString(storageConnectionString)
    this.transcriptionContainer = transcriptionContainer
    this.speechServiceKey = speechServiceKey
  }

  async run ({ url, sleep }) {
    // TODO: replace polling with webhook when https://github.com/MicrosoftDocs/azure-docs/issues/35553 is fixed
    const transcription = await this.waitForTranscription({ url, sleep })

    await this.copyTranscriptionToStorage(transcription)
  }

  async waitForTranscription ({ url, sleep }) {
    let transcription = null

    while (true) {
      sleep = sleep > 0 ? sleep : POLLING_INTERVAL_SECONDS

      this.log(`Waiting for ${sleep} seconds for transcription at ${url}.`)
      await sleepForSeconds(sleep)

      const response = await got.get(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.speechServiceKey
        }
      })

      transcription = JSON.parse(response.body)

      if (transcription.status === 'Succeeded' || transcription.status === 'Failed') {
        break
      }

      sleep = Number(response.headers['x-ratelimit-remaining']) === 0
        ? (new Date(response.headers['x-ratelimit-reset']) - new Date()) / 1000
        : Number(response.headers['retry-after'])
    }

    return transcription
  }

  async copyTranscriptionToStorage (transcription) {
    const container = await this.createContainerIfNotExists()

    await Promise.all(Object.entries(transcription.resultsUrls).map(([resultType, url]) => {
      const blob = container.getBlobClient(`${transcription.name}.${resultType}.json`)
      this.log(`Copying transcription to ${blob.url}.`)
      return blob.startCopyFromURL(url)
    }))
  }

  async createContainerIfNotExists () {
    const containerClient = this.blobServiceClient.getContainerClient(this.transcriptionContainer)

    try {
      await containerClient.create()
    } catch (err) {
      if (err.details.errorCode !== 'ContainerAlreadyExists') {
        throw err
      }
    }

    return containerClient
  }
}

module.exports = Main
