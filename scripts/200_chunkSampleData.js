#!/usr/bin/env node

const childProcess = require('child_process')
const fs = require('fs')
const hasbin = require('hasbin')
const mkdirp = require('mkdirp')
const path = require('path')
const promisify = require('util').promisify
const sprintf = require('sprintf-js').sprintf
const temp = require('temp').track()

const exec = promisify(childProcess.exec)

if (!hasbin.sync('ffmpeg')) {
  console.error('The ffmpeg utility is required for this script.')
  process.exit(1)
}

if (!hasbin.sync('sox')) {
  console.error('The sox utility is required for this script.')
  process.exit(1)
}

const inDir = path.join(__dirname, '..', 'data', 'audio')
if (!fs.existsSync(inDir)) {
  console.error(`Input directory ${inDir} does not exist.`)
  process.exit(1)
}

const outDir = path.join(__dirname, '..', 'data', 'chunks')
mkdirp.sync(outDir)

const chunkMinutes = 4

const chunkAudio = async filePath => {
  const fileBaseName = path.basename(filePath).split('.').slice(0, -1).join('.')
  const chunkPattern = path.join(outDir, `${fileBaseName}-%04d.wav`)

  if (fs.existsSync(sprintf(chunkPattern, 0))) {
    console.log(`Skipping ${filePath} since it has already been chunked.`)
  } else {
    const ffmpegDirectory = await temp.mkdir()
    const soxDirectory = await temp.mkdir()

    const wavFile = path.join(ffmpegDirectory, `${fileBaseName}.wav`)
    const wavChunkPattern = path.join(soxDirectory, `${fileBaseName}-%04d.raw.wav`)

    console.log(`Converting ${filePath} to wav pcm 16k 16bit mono ${chunkMinutes} minute chunks.`)
    await exec(`ffmpeg -i "${filePath}" -f wav "${wavFile}"`)
    await exec(`ffmpeg -i "${wavFile}" -c copy -map 0 -segment_time "${chunkMinutes * 60}" -f segment "${wavChunkPattern}"`)

    for (const [i, wavChunk] of fs.readdirSync(soxDirectory).entries()) {
      const wavChunkPath = path.join(soxDirectory, wavChunk)
      const outChunkPath = sprintf(chunkPattern, i)
      await exec(`sox "${wavChunkPath}" -r 16000 -b 16 -c 1 "${outChunkPath}"`)
    }
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
