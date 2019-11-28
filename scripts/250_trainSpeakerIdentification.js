#!/usr/bin/env node

const MongoClient = require('mongodb').MongoClient
const envalid = require('envalid')
const fs = require('fs')
const got = require('got')
const process = require('process')
const promisify = require('util').promisify
const sleepFor = require('sleep-promise')
const stream = require('stream')

const pipeline = promisify(stream.pipeline)

const env = envalid.cleanEnv(process.env, {
  SPEAKER_RECOGNITION_KEY: envalid.str(),
  SPEAKER_RECOGNITION_ENDPOINT: envalid.str(),
  MONGODB_CONNECTION_STRING: envalid.str(),
  MONGODB_DATABASE: envalid.str(),
  MODELS_COLLECTION: envalid.str()
})

if (process.argv.length !== 4 || !fs.existsSync(process.argv[3])) {
  console.error(`Usage: node ${process.argv[1]} <speaker-name> <path-to-audio-file>`)
  process.exit(1)
}

const speakerIdentificationClient = got.extend({
  baseUrl: env.SPEAKER_RECOGNITION_ENDPOINT,
  headers: {
    'Ocp-Apim-Subscription-Key': env.SPEAKER_RECOGNITION_KEY
  }
})

const mongoClient = new MongoClient(env.MONGODB_CONNECTION_STRING, { useUnifiedTopology: true })

const storeSpeakerProfile = async (profile, speakerName) => {
  const client = await mongoClient.connect()
  const collection = client.db(env.MONGODB_DATABASE).collection(env.MODELS_COLLECTION)
  await collection.insertOne({ ...profile, speakerName })
  await client.close()
  console.log(`Stored profile ${profile.identificationProfileId} for speaker ${speakerName}.`)
}

const createIdentificationProfile = async speakerName => {
  const response = await speakerIdentificationClient.post('/identificationProfiles', {
    body: JSON.stringify({ locale: 'en-US' }),
    headers: { 'Content-Type': 'application/json' }
  })

  const { identificationProfileId } = JSON.parse(response.body)

  console.log(`Created profile ${identificationProfileId} for speaker ${speakerName}.`)
  return identificationProfileId
}

const enrollSpeaker = async (identificationProfileId, audioPath) => {
  await pipeline(
    fs.createReadStream(audioPath),
    speakerIdentificationClient.stream.post(`/identificationProfiles/${identificationProfileId}/enroll`, {
      headers: { 'Content-Type': 'application/octet-stream' }
    })
  )
  console.log(`Training profile ${identificationProfileId} on audio ${audioPath}.`)

  let profile = null

  while (true) {
    const response = await speakerIdentificationClient.get(`/identificationProfiles/${identificationProfileId}`)

    profile = JSON.parse(response.body)

    if (profile.enrollmentStatus === 'Enrolled') {
      break
    }

    console.log(`Waiting for training of profile ${identificationProfileId}, status is ${profile.enrollmentStatus}.`)
    await sleepFor(1000)
  }
  console.log(`Profile ${identificationProfileId} is ready to be used.`)

  return profile
}

const main = async (speakerName, audioPath) => {
  const identificationProfileId = await createIdentificationProfile(speakerName)
  const profile = await enrollSpeaker(identificationProfileId, audioPath)
  await storeSpeakerProfile(profile, speakerName)
}

main(process.argv[2], process.argv[3])
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
