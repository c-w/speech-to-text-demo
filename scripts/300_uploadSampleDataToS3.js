#!/usr/bin/env node

const aws = require('aws-sdk')
const envalid = require('envalid')
const fs = require('fs')
const path = require('path')
const process = require('process')

const inDir = path.join(__dirname, '..', 'data', 'chunks')
if (!fs.existsSync(inDir)) {
  console.error(`Input directory ${inDir} does not exist.`)
  process.exit(1)
}

const env = envalid.cleanEnv(process.env, {
  AWS_ACCESS_KEY_ID: envalid.str(),
  AWS_SECRET_ACCESS_KEY: envalid.str(),
  AWS_ENDPOINT: envalid.str(),
  AWS_BUCKET: envalid.str()
})

const s3 = new aws.S3({
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  endpoint: env.AWS_ENDPOINT,
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
})

const uploadToS3 = async filePath => {
  await s3.upload({
    Bucket: env.AWS_BUCKET,
    Key: path.basename(filePath),
    Body: fs.createReadStream(filePath)
  }).promise()
}

const createBucketIfNotExists = async () => {
  try {
    await s3.createBucket({ Bucket: env.AWS_BUCKET }).promise()
    console.log(`Created S3 bucket ${env.AWS_BUCKET}.`)
  } catch (err) {
    if (err.code !== 'BucketAlreadyOwnedByYou') {
      throw err
    }
    console.log(`S3 bucket ${env.AWS_BUCKET} already exists.`)
  }
}

const main = async () => {
  await createBucketIfNotExists()

  for (const fileName of fs.readdirSync(inDir)) {
    const filePath = path.join(inDir, fileName)
    await uploadToS3(filePath)
    console.log(`Uploaded ${filePath} to S3 bucket ${env.AWS_BUCKET}.`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
