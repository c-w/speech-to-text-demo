#!/usr/bin/env node

const childProcess = require('child_process')
const mkdirp = require('mkdirp')
const path = require('path')
const promisify = require('util').promisify
const zipper = require('zip-local')

const exec = promisify(childProcess.exec)

async function withDir (directory, context) {
  const currentDirectory = process.cwd()
  process.chdir(directory)
  const result = await context()
  process.chdir(currentDirectory)
  return result
}

async function packageCode () {
  const codeDirectory = path.join(__dirname, '..', 'functions')
  const zipDirectory = path.join(__dirname, '..', 'data', 'code')
  const zipPath = path.join(zipDirectory, `${new Date().getTime()}.zip`)
  mkdirp.sync(zipDirectory)

  await withDir(codeDirectory, () => exec('npm install --only=prod'))

  zipper.sync.zip(codeDirectory).compress().save(zipPath)

  return zipPath
}

async function main () {
  const codeZip = await packageCode()
  console.log(codeZip)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
