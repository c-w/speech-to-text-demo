const azureStorage = require('@azure/storage-blob')
const got = require('got')
const moment = require('moment')
const sleepFor = require('sleep-promise')

/**
 * @typedef {import('../types').EventGridEvent} EventGridEvent
 * @typedef {import('../types').Logger} Logger
 * @typedef {import('../types').PendingTranscription} PendingTranscription
 * @typedef {import('../types').Transcription} Transcription
 * @typedef {import('@azure/storage-blob').StorageSharedKeyCredential} StorageSharedKeyCredential
 */

const POLLING_INTERVAL_SECONDS = 5

class Main {
  /**
   * @constructor
   * @param {object} args
   * @param {Logger} args.log
   * @param {string} args.storageConnectionString
   * @param {string} args.transcriptionContainer
   * @param {string} args.speechServiceKey
   */
  constructor ({ log, storageConnectionString, transcriptionContainer, speechServiceKey }) {
    this.log = log
    this.blobServiceClient = azureStorage.BlobServiceClient.fromConnectionString(storageConnectionString)
    this.transcriptionContainer = transcriptionContainer
    this.speechServiceClient = got.extend({
      headers: { 'Ocp-Apim-Subscription-Key': speechServiceKey }
    })
  }

  /**
   * @param {PendingTranscription} pendingTranscription
   */
  async run (pendingTranscription) {
    // TODO: replace polling with webhook when https://github.com/MicrosoftDocs/azure-docs/issues/35553 is fixed
    const finishedTranscription = await this.waitForTranscription(pendingTranscription)

    await this.copyTranscriptionToStorage(finishedTranscription)
  }

  /**
   * @param {PendingTranscription} args
   * @returns {Promise<Transcription>}
   */
  async waitForTranscription ({ url, sleep }) {
    let transcription = null

    while (true) {
      sleep = sleep > 0 ? sleep : POLLING_INTERVAL_SECONDS

      this.log(`Waiting for ${sleep} seconds for transcription at ${url}.`)
      await sleepFor(sleep * 1000)

      const response = await this.speechServiceClient.get(url)

      transcription = JSON.parse(response.body)

      if (transcription.status === 'Succeeded' || transcription.status === 'Failed') {
        break
      }

      sleep = Number(response.headers['x-ratelimit-remaining']) === 0
        ? moment(response.headers['x-ratelimit-reset']).unix() - moment().unix()
        : Number(response.headers['retry-after'])
    }

    return transcription
  }

  /**
   * @param {Transcription} transcription
   */
  async copyTranscriptionToStorage (transcription) {
    const container = await this.createContainerIfNotExists()

    await Promise.all(Object.entries(transcription.resultsUrls).map(async ([resultType, url]) => {
      const blob = container.getBlobClient(`${transcription.name}.${resultType}.json`)
      this.log(`Copying transcription to ${blob.url}.`)
      const blobCopy = await blob.beginCopyFromURL(url)
      return blobCopy.pollUntilDone()
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
