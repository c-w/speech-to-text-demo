const MongoClient = require('mongodb').MongoClient
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
   * @param {string} args.mongodbConnectionString
   * @param {string} args.mongodbDatabase
   * @param {string} args.transcriptionCollection
   * @param {string} args.speechServiceKey
   */
  constructor ({ log, mongodbConnectionString, mongodbDatabase, transcriptionCollection, speechServiceKey }) {
    this.log = log
    this.mongoClient = new MongoClient(mongodbConnectionString, { useUnifiedTopology: true })
    this.mongodbDatabase = mongodbDatabase
    this.transcriptionCollection = transcriptionCollection
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

    await this.storeTranscriptionInMongoDB(finishedTranscription)
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
  async storeTranscriptionInMongoDB (transcription) {
    const client = await this.mongoClient.connect()
    const db = client.db(this.mongodbDatabase)
    const collection = db.collection(this.transcriptionCollection)

    const createdDate = moment(transcription.createdDateTime).format('YYYY-MM-DD')
    const recordingsUrl = transcription.recordingsUrl.split('?')[0]

    for (const [resultType, url] of Object.entries(transcription.resultsUrls)) {
      const transcriptionResponse = await this.speechServiceClient.get(url)
      console.log(`Fetched transcription ${resultType} for ${recordingsUrl}.`)

      await collection.insertOne({
        createdDate,
        recordingsUrl,
        resultType,
        ...JSON.parse(transcriptionResponse.body)
      })
      console.log(`Stored transcription ${resultType} for ${recordingsUrl} in collection ${this.transcriptionCollection}.`)
    }

    await client.close()
  }
}

module.exports = Main
