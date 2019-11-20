# Speech To Text Demo

## What's this?

This repository is a demo project that implements a workflow using [Azure Speech To Text Batch Transcription](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/batch-transcription).

![Architecture overview](https://user-images.githubusercontent.com/1086421/69286430-34c2d980-0bc1-11ea-8291-2a9607a28a09.png)

## Setup

1. Install the dependencies via `npm install`.
2. Copy `.env.template` and `local.settings.json.template` to create the configuration files `.env` and `local.settings.json`.
3. Create a CRIS.ai speech resource and use its region and access key to fill-in the placeholders `<cris region>` and `<cris access key>` in the `local.settings.json` configuration file.
4. Create an Azure Storage account and use its account name, access key and connection key to fill-in the placeholders `<storage account name>`, `<storage access key>` and `<storage connection string>` in the `.env` and `local.settings.json` configuration files.
5. Deploy the project as an Azure Function App and register an EventGrid subscription between the storage account and the function app.
6. Run `docker-compose up` to start the MinIO Azure Gateway and replace `<minio endpoint>` with `http://localhost:9000` in the `.env` configuration file.
7. Execute `node scripts/100_downloadSampleData.js` followed by `node scripts/200_chunkSampleData.js` to create some test data.
8. Execute `node scripts/300_uploadSampleDataToS3.js` to trigger the audio transcription workflow.
