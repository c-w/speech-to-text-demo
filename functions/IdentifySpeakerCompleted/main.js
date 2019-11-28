const MongoClient = require('mongodb').MongoClient
const got = require('got')
const moment = require('moment')
const sleepFor = require('sleep-promise')
const { POLLING_INTERVAL_SECONDS } = require('../common')

/**
 * @typedef {import('../types').EventGridEvent} EventGridEvent
 * @typedef {import('../types').Logger} Logger
 * @typedef {import('../types').PendingIdentification} PendingIdentification
 * @typedef {import('../types').Identification} Identification
 */

const SPEAKER_UNKNOWN = '00000000-0000-0000-0000-000000000000'

class Main {
  /**
   * @constructor
   * @param {object} args
   * @param {Logger} args.log
   * @param {string} args.mongodbConnectionString
   * @param {string} args.mongodbDatabase
   * @param {string} args.speakerCollection
   * @param {string} args.speakerRecognitionKey
   */
  constructor ({ log, mongodbConnectionString, mongodbDatabase, speakerCollection, speakerRecognitionKey }) {
    this.log = log
    this.mongoClient = new MongoClient(mongodbConnectionString, { useUnifiedTopology: true })
    this.mongodbDatabase = mongodbDatabase
    this.speakerCollection = speakerCollection
    this.speakerRecognitionClient = got.extend({
      headers: { 'Ocp-Apim-Subscription-Key': speakerRecognitionKey }
    })
  }

  /**
   * @param {PendingIdentification} pendingIdentification
   */
  async run (pendingIdentification) {
    const finishedIdentification = await this.waitForIdentification(pendingIdentification)

    if (finishedIdentification != null) {
      await this.storeIdentificationInMongoDB(pendingIdentification.recordingsUrl, finishedIdentification)
    }
  }

  /**
   * @param {PendingIdentification} args
   * @returns {Promise<Identification | undefined>}
   */
  async waitForIdentification ({ recordingsUrl, url }) {
    let identification = null

    while (true) {
      this.log(`Waiting for ${POLLING_INTERVAL_SECONDS} seconds for identification of ${recordingsUrl} at ${url}.`)
      await sleepFor(POLLING_INTERVAL_SECONDS * 1000)

      const response = await this.speakerRecognitionClient.get(url)

      identification = JSON.parse(response.body)

      if (identification.status === 'succeeded' || identification.status === 'failed') {
        break
      }
    }

    if (identification.identifiedProfileId === SPEAKER_UNKNOWN) {
      this.log(`Unknown speaker for identification of ${recordingsUrl} at ${url}.`)
      return undefined
    }

    return identification
  }

  /**
   * @param {string} recordingsUrl
   * @param {Identification} identification
   */
  async storeIdentificationInMongoDB (recordingsUrl, identification) {
    const client = await this.mongoClient.connect()
    const db = client.db(this.mongodbDatabase)
    const collection = db.collection(this.speakerCollection)

    await collection.insertOne({
      ...identification,
      createdDate: moment(identification.createdDateTime).format('YYYY-MM-DD'),
      recordingsUrl
    })
    console.log(`Stored identification for ${recordingsUrl} in collection ${this.speakerCollection}.`)

    await client.close()
  }
}

module.exports = Main
