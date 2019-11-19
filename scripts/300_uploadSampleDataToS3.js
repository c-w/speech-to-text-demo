#!/usr/bin/env node

const aws = require('aws-sdk')
const dotenv = require('dotenv')
const fs = require('fs')
const path = require('path')
const process = require('process')
const uuidv4 = require('uuid/v4')

dotenv.config()

const inDir = path.join(__dirname, '..', 'data', 'chunks')
if (!fs.existsSync(inDir)) {
  console.error(`Input directory ${inDir} does not exist.`)
  process.exit(1)
}

const ensureEnv = key => {
  const value = process.env[key]

  if (!value) {
    console.error(`Missing environment variable: ${key}.`)
    process.exit(1)
  }

  return value
}

const awsAccessKeyId = ensureEnv('AWS_ACCESS_KEY_ID')
const awsSecretAccessKey = ensureEnv('AWS_SECRET_ACCESS_KEY')
const awsEndpoint = ensureEnv('AWS_ENDPOINT')
const awsBucket = uuidv4().replace(/[^a-zA-Z0-9]/, '')

const s3 = new aws.S3({
  accessKeyId: awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
  endpoint: awsEndpoint,
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
})

const uploadToS3 = async filePath => {
  await s3.upload({
    Bucket: awsBucket,
    Key: path.basename(filePath),
    Body: fs.createReadStream(filePath)
  }).promise()
}

const main = async () => {
  await s3.createBucket({ Bucket: awsBucket }).promise()
  console.log(`Created S3 bucket ${awsBucket}.`)

  for (const fileName of fs.readdirSync(inDir)) {
    const filePath = path.join(inDir, fileName)
    await uploadToS3(filePath)
    console.log(`Uploaded ${filePath} to S3 bucket ${awsBucket}.`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
