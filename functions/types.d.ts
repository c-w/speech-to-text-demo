import { Context as AzureFunctionsContext } from '@azure/functions'
export { AzureFunctionsContext }

export interface Logger {
  (message: string): void;
}

export interface EventGridEvent {
  eventType: string;

  data: {
    url: string;
  }
}

export interface PendingTranscription {
  url: string;
  sleep: number;
}

export interface Transcription {
  createdDateTime: string;
  recordingsUrl: string;
  resultsUrls: { [key: string]: string };
  name: string;
}
