# Speech To Text Demo

[![Build Status](https://clewolff.visualstudio.com/speech-to-text-demo/_apis/build/status/c-w.speech-to-text-demo?branchName=master)](https://clewolff.visualstudio.com/speech-to-text-demo/_build/latest?definitionId=7&branchName=master)

## What's this?

This repository is a demo project that implements a workflow using [Azure Speech To Text Batch Transcription](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/batch-transcription).

![Architecture overview](https://user-images.githubusercontent.com/1086421/69766585-a3b2ac00-1146-11ea-994f-8c4b094c4b1d.png)

## Setup

```bash
# start the development environment container
> docker build -t devenv .
> docker run -it devenv

# connect to azure
$ az login --use-device-code

# deploy the system
$ cd ./infrastructure
$ node ../scripts/000_packageCode.js
$ terraform apply -var subscription_id=<azure-subscription-id> -var prefix=<resource-prefix> -var code_zip=<path-to-code-package>
$ node ../scripts/050_writeConfigFiles.js
$ cd ..

# create some test data
$ node scripts/100_downloadSampleData.js
$ node scripts/200_chunkSampleData.js

# train speaker identification profiles
$ node scripts/250_trainSpeakerIdentification.js "Stewart Wills" ./data/chunks/mobydick_001_002_melville-0000.wav
$ node scripts/250_trainSpeakerIdentification.js "Sherry Crowther" ./data/chunks/emma_01_01_austen-0000.wav
$ node scripts/250_trainSpeakerIdentification.js "Mary Ann" ./data/chunks/warandpeace1_01_tolstoy-0000.wav

# trigger the audio transcription workflow
$ node scripts/300_uploadSampleDataToS3.js
```
