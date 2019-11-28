output "mongodbConnectionString" {
  value = azurerm_cosmosdb_account.metadata_mongodb.connection_strings[0]
}

output "mongodbDatabase" {
  value = azurerm_cosmosdb_mongo_database.metadata_db.name
}

output "transcriptionCollection" {
  value = azurerm_cosmosdb_mongo_collection.transcription_collection.name
}

output "speakerCollection" {
  value = azurerm_cosmosdb_mongo_collection.speaker_collection.name
}

output "modelsCollection" {
  value = azurerm_cosmosdb_mongo_collection.models_collection.name
}

output "storageAccountName" {
  value = azurerm_storage_account.data_storage_account.name
}

output "storageAccountKey" {
  value = azurerm_storage_account.data_storage_account.primary_access_key
}

output "minioEndpoint" {
  value = "https://${azurerm_app_service.minio_app.default_site_hostname}"
}

output "servicebusConnectionString" {
  value = azurerm_servicebus_namespace.queues.default_primary_connection_string
}

output "audioContainerName" {
  value = var.audio_container_name
}

output "speakerRecognitionAccessKey" {
  value = azurerm_cognitive_account.speaker_recognition.primary_access_key
}

output "speakerRecognitionEndpoint" {
  value = azurerm_cognitive_account.speaker_recognition.endpoint
}

output "crisAccessKey" {
  value = azurerm_cognitive_account.speech_to_text.primary_access_key
}

output "crisEndpoint" {
  value = "https://${var.location}.cris.ai/api/speechtotext/v2.0"
}

output "storageConnectionString" {
  value = azurerm_storage_account.data_storage_account.primary_connection_string
}
