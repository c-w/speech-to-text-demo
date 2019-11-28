const azureStorage = require('@azure/storage-blob')
const chunk = require('lodash.chunk')
const got = require('got')
const { EVENTGRID_BLOB_CREATED, credentialFromConnectionString } = require('../common')

/**
 * @typedef {import('../types').EventGridEvent} EventGridEvent
 * @typedef {import('../types').Logger} Logger
 * @typedef {import('../types').PendingIdentification} PendingIdentification
 */

const SPEAKER_MAX_PROFILES_PER_IDENTIFY_REQUEST = 10

class Main {
  /**
   * @constructor
   * @param {object} args
   * @param {Logger} args.log
   * @param {string} args.storageConnectionString
   * @param {string} args.speakerRecognitionKey
   * @param {string} args.speakerRecognitionEndpoint
   */
  constructor ({ log, storageConnectionString, speakerRecognitionKey, speakerRecognitionEndpoint }) {
    this.log = log
    this.storageCredential = credentialFromConnectionString(storageConnectionString)
    this.speakerRecognitionClient = got.extend({
      baseUrl: speakerRecognitionEndpoint,
      headers: { 'Ocp-Apim-Subscription-Key': speakerRecognitionKey }
    })
  }

  /**
   * @param {object} args
   * @param {EventGridEvent} args.event
   * @returns {Promise<PendingIdentification[]>}
   */
  async run ({ event }) {
    if (event.eventType !== EVENTGRID_BLOB_CREATED) {
      this.log(`Skipping event of type ${event.eventType}.`)
      return []
    }

    const blobURL = event.data.url

    const [allSpeakers, blobContent] = await Promise.all([
      this.fetchIdentificationProfileIds(),
      this.fetchBlob(blobURL)
    ])

    /** @type {any[]} */
    const operations = await Promise.all(
      chunk(allSpeakers, SPEAKER_MAX_PROFILES_PER_IDENTIFY_REQUEST)
        .map(speakers => this.identifySpeakers(blobContent, speakers))
    )

    return operations
      .filter(url => url != null)
      .map(url => ({ url, recordingsUrl: blobURL }))
  }

  /**
   * @param {string} blobURL
   * @returns {Promise<Buffer>}
   */
  async fetchBlob (blobURL) {
    const blob = new azureStorage.BlobClient(blobURL, this.storageCredential)
    return blob.downloadToBuffer()
  }

  /**
   * @returns {Promise<string[]>}
   */
  async fetchIdentificationProfileIds () {
    const profilesResponse = await this.speakerRecognitionClient.get('/identificationProfiles')

    /** @type {object[]} */
    const profiles = JSON.parse(profilesResponse.body)

    return profiles
      .filter(profile => profile.enrollmentStatus === 'Enrolled')
      .map(profile => profile.identificationProfileId)
  }

  /**
   * @param {Buffer} blobContent
   * @param {string[]} speakers
   * @returns {Promise<string | undefined>}
   */
  async identifySpeakers (blobContent, speakers) {
    const query = encodeURIComponent(speakers.join(','))

    const response = await this.speakerRecognitionClient.post(`/identify?identificationProfileIds=${query}`, {
      body: blobContent,
      headers: { 'Content-Type': 'application/octet-stream' }
    })

    const url = response.headers['operation-location']
    if (url == null || Array.isArray(url)) {
      this.log(`Got bad operation-location ${url} for identification request of ${query}`)
      return undefined
    }

    return url
  }
}

module.exports = Main
