const azureStorage = require('@azure/storage-blob')
const got = require('got')

/**
 * @typedef {import('../types').EventGridEvent} EventGridEvent
 * @typedef {import('../types').Logger} Logger
 * @typedef {import('../types').PendingTranscription} PendingTranscription
 * @typedef {import('@azure/storage-blob').StorageSharedKeyCredential} StorageSharedKeyCredential
 */

const EVENTGRID_BLOB_CREATED = 'Microsoft.Storage.BlobCreated'
const BLOB_SAS_EXIRY_HOURS = 48
const BLOB_SAS_LOOKBACK_MINUTES = 5

/**
 * @param {string} storageConnectionString
 * @returns {StorageSharedKeyCredential}
 */
function credentialFromConnectionString (storageConnectionString) {
  const parts = storageConnectionString.split(';').map(kv => kv.split('='))
  const accountName = parts.filter(([key, _]) => key === 'AccountName')[0][1]
  const accountKey = parts.filter(([key, _]) => key === 'AccountKey')[0][1]
  return new azureStorage.StorageSharedKeyCredential(accountName, accountKey)
}

class Main {
  /**
   * @constructor
   * @param {object} args
   * @param {Logger} args.log
   * @param {string} args.storageConnectionString
   * @param {string} args.speechServiceKey
   * @param {string} args.speechServiceEndpoint
   */
  constructor ({ log, storageConnectionString, speechServiceKey, speechServiceEndpoint }) {
    this.log = log
    this.storageCredential = credentialFromConnectionString(storageConnectionString)
    this.speechServiceClient = got.extend({
      baseUrl: speechServiceEndpoint,
      headers: { 'Ocp-Apim-Subscription-Key': speechServiceKey }
    })
  }

  /**
   * @param {object} args
   * @param {EventGridEvent} args.event
   * @returns {Promise<PendingTranscription | undefined>}
   */
  async run ({ event }) {
    if (event.eventType !== EVENTGRID_BLOB_CREATED) {
      this.log(`Skipping event of type ${event.eventType}.`)
      return
    }

    const blobURL = event.data.url
    const blobSASURL = this.createBlobSASURL({ blobURL })
    const transcription = await this.requestTranscription({ audioURL: blobSASURL })

    this.log(`Transcription for ${blobURL} is running at ${transcription.url}.`)
    return transcription
  }

  /**
   * @param {object} args
   * @param {string} args.blobURL
   * @returns {string}
   */
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

  /**
   * @param {object} args
   * @param {string} args.audioURL
   * @returns {Promise<PendingTranscription>}
   */
  async requestTranscription ({ audioURL }) {
    let response

    try {
      response = await this.speechServiceClient.post('/transcriptions', {
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
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (err) {
      if (err.response) {
        const error = JSON.parse(err.response.body)
        throw new Error(`[HTTP ${err.response.statusCode}] ${error.code}: ${error.message}`)
      }
      throw err
    }

    const transcriptionURL = response.headers.location
    if (!transcriptionURL) {
      throw new Error('No location header present in transcription response')
    }

    return {
      url: transcriptionURL,
      sleep: Number(response.headers['retry-after'])
    }
  }
}

module.exports = Main
