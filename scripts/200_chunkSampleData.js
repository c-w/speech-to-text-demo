#!/usr/bin/env node

const cmd = require('node-cmd')
const fs = require('fs')
const hasbin = require('hasbin')
const mkdirp = require('mkdirp')
const path = require('path')
const promisify = require('util').promisify
const sprintf = require('sprintf-js').sprintf

const run = promisify(cmd.run)

if (!hasbin.sync('ffmpeg')) {
  console.error('The ffmpeg utility is required for this script.')
  process.exit(1)
}

const inDir = path.join(__dirname, '..', 'data', 'audio')
if (!fs.existsSync(inDir)) {
  console.error(`Input directory ${inDir} does not exist.`)
  process.exit(1)
}

const outDir = path.join(__dirname, '..', 'data', 'chunks')
mkdirp.sync(outDir)

const chunkMinutes = 5

const chunkAudio = async filePath => {
  const fileNameParts = path.basename(filePath).split('.')
  const fileExtension = fileNameParts.pop()
  const fileBaseName = fileNameParts.join('.')
  const chunkPattern = path.join(outDir, `${fileBaseName}-%04d.${fileExtension}`)
  if (fs.existsSync(sprintf(chunkPattern, 0))) {
    console.log(`Skipping ${filePath} since it has already been chunked.`)
  } else {
    console.log(`Splitting ${filePath} into chunks of ${chunkMinutes} minutes.`)
    await run(`ffmpeg -i '${filePath}' -c copy -map 0 -segment_time ${chunkMinutes * 60} -f segment ${chunkPattern}`)
  }
}

const files = fs.readdirSync(inDir).map(fileName => path.join(inDir, fileName))

Promise.all(files.map(chunkAudio))
  .then(() => {
    console.log(`Chunked ${files.length} audio files to ${outDir}.`)
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
