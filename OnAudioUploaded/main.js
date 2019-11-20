const azureStorage = require('@azure/storage-blob')
const got = require('got')

const EVENTGRID_BLOB_CREATED = 'Microsoft.Storage.BlobCreated'
const BLOB_SAS_EXIRY_HOURS = 48
const BLOB_SAS_LOOKBACK_MINUTES = 5

class Main {
  constructor ({ log, storageAccountName, storageAccountKey, speechServiceKey, speechServiceEndpoint }) {
    this.log = log
    this.storageCredential = new azureStorage.StorageSharedKeyCredential(storageAccountName, storageAccountKey)
    this.speechServiceKey = speechServiceKey
    this.speechServiceEndpoint = speechServiceEndpoint
  }

  async run ({ event }) {
    if (event.eventType !== EVENTGRID_BLOB_CREATED) {
      this.log(`Skipping event of type ${event.eventType}.`)
      return
    }

    const blobURL = event.data.url
    const blobSASURL = this.createBlobSASURL({ blobURL })
    const transcriptionURL = await this.requestTranscription({ audioURL: blobSASURL })

    this.log(`Transcription for ${blobURL} is running at ${transcriptionURL}.`)
  }

  createBlobSASURL ({ blobURL }) {
    const blob = new azureStorage.BlobClient(blobURL)

    const startsOn = new Date()
    startsOn.setMinutes(startsOn.getMinutes() - BLOB_SAS_LOOKBACK_MINUTES)

    const expiresOn = new Date()
    expiresOn.setHours(expiresOn.getHours() + BLOB_SAS_EXIRY_HOURS)

    const permissions = new azureStorage.BlobSASPermissions()
    permissions.read = true

    const blobSAS = azureStorage.generateBlobSASQueryParameters({
      blobName: blob.name,
      containerName: blob.containerName,
      startsOn,
      expiresOn,
      permissions
    }, this.storageCredential)

    return `${blobURL}?${blobSAS}`
  }

  async requestTranscription ({ audioURL }) {
    let response

    try {
      response = await got.post(`${this.speechServiceEndpoint}/api/speechtotext/v2.0/transcriptions`, {
        body: JSON.stringify({
          name: new URL(audioURL).pathname.substr(1),
          description: null,
          recordingsUrl: audioURL,
          locale: 'en-US',
          models: null,
          properties: {
            AddDiarization: false,
            AddSentiment: false,
            AddWordLevelTimestamps: false,
            ProfanityFilterMode: 'None',
            PunctuationMode: 'Automatic'
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.speechServiceKey
        }
      })
    } catch (err) {
      if (err.response) {
        const error = JSON.parse(err.response.body)
        throw new Error(`[HTTP ${err.response.statusCode}] ${error.code}: ${error.message}`)
      }
      throw err
    }

    return response.headers.location
  }
}

module.exports = Main
