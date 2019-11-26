# Speech To Text Demo

[![Build Status](https://clewolff.visualstudio.com/speech-to-text-demo/_apis/build/status/c-w.speech-to-text-demo?branchName=master)](https://clewolff.visualstudio.com/speech-to-text-demo/_build/latest?definitionId=7&branchName=master)

## What's this?

This repository is a demo project that implements a workflow using [Azure Speech To Text Batch Transcription](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/batch-transcription).

![Architecture overview](https://user-images.githubusercontent.com/1086421/69460813-0a992500-0d43-11ea-82f6-102f2de8a861.png)

## Setup

```bash
# start the development environment container
> docker build -t devenv .
> docker run -v $(pwd):/app -it devenv

# connect to azure
$ az login --use-device-code

# create some test data
$ node scripts/000_createInfrastructure.js <azure-subscription-id> <resource-prefix>
$ node scripts/100_downloadSampleData.js
$ node scripts/200_chunkSampleData.js

# trigger the audio transcription workflow
$ node scripts/300_uploadSampleDataToS3.js
```
