#!/usr/bin/env node

const fs = require('fs')
const got = require('got')
const mkdirp = require('mkdirp')
const path = require('path')
const promisify = require('util').promisify
const stream = require('stream')

const pipeline = promisify(stream.pipeline)

const urls = [
  'http://www.archive.org/download/moby_dick_librivox/mobydick_001_002_melville.mp3',
  'http://www.archive.org/download/moby_dick_librivox/mobydick_003_melville.mp3',
  'http://www.archive.org/download/moby_dick_librivox/mobydick_004_007_melville.mp3',
  'http://www.archive.org/download/moby_dick_librivox/mobydick_008_009_melville.mp3'
]

const outDir = path.join(__dirname, '..', 'data', 'audio')
mkdirp.sync(outDir)

const downloadIfNotExists = async url => {
  const fileName = path.join(outDir, path.basename(url))
  if (fs.existsSync(fileName)) {
    console.log(`Skipping ${url} since it has already been downloaded.`)
  } else {
    console.log(`Downloading ${url}.`)
    await pipeline(got.stream(url), fs.createWriteStream(fileName))
  }
}

Promise.all(urls.map(downloadIfNotExists))
  .then(() => {
    console.log(`Downloaded ${urls.length} audio files to ${outDir}.`)
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
