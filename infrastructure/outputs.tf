output "storageAccountName" {
  value = azurerm_storage_account.data_storage_account.name
}

output "storageAccountKey" {
  value = azurerm_storage_account.data_storage_account.primary_access_key
}

output "minioEndpoint" {
  value = "https://${azurerm_app_service.minio_app.default_site_hostname}"
}

output "audioContainerName" {
  value = var.audio_container_name
}

output "crisAccessKey" {
  value = azurerm_cognitive_account.speech_to_text.primary_access_key
}

output "crisEndpoint" {
  value = "https://${var.location}.cris.ai"
}

output "transcriptionContainerName" {
  value = var.transcription_container_name
}

output "storageConnectionString" {
  value = azurerm_storage_account.data_storage_account.primary_connection_string
}
