const azureStorage = require('@azure/storage-blob')

/**
 * @typedef {import('@azure/storage-blob').StorageSharedKeyCredential} StorageSharedKeyCredential
 */

module.exports.EVENTGRID_BLOB_CREATED = 'Microsoft.Storage.BlobCreated'

module.exports.POLLING_INTERVAL_SECONDS = 5

/**
 * @param {string} storageConnectionString
 * @returns {StorageSharedKeyCredential}
 */
module.exports.credentialFromConnectionString = storageConnectionString => {
  const parts = storageConnectionString.split(';').map(kv => kv.split('='))
  const accountName = parts.filter(([key, _]) => key === 'AccountName')[0][1]
  const accountKey = parts.filter(([key, _]) => key === 'AccountKey')[0][1]
  return new azureStorage.StorageSharedKeyCredential(accountName, accountKey)
}
