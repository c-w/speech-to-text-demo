# Speech To Text Demo

## What's this?

This repository is a demo project that implements a workflow using [Azure Speech To Text Batch Transcription](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/batch-transcription).

![Architecture overview](https://user-images.githubusercontent.com/1086421/69286430-34c2d980-0bc1-11ea-8291-2a9607a28a09.png)

## Setup

1. Install the dependencies via `npm install --only=prod`.
2. Execute `node scripts/000_createInfrastructure.js` to deploy the solution to Azure.
3. Execute `node scripts/100_downloadSampleData.js` followed by `node scripts/200_chunkSampleData.js` to create some test data.
4. Execute `node scripts/300_uploadSampleDataToS3.js` to trigger the audio transcription workflow.
