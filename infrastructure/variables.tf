variable "subscription_id" {
  type = string
}

variable "prefix" {
  type = string
}

variable "code_zip" {
  type = string
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "tag_name" {
  type    = string
  default = "sttdeployment"
}

variable "mongodb_database" {
  type    = string
  default = "speechtotextdemo"
}

variable "transcription_collection_name" {
  type    = string
  default = "transcription"
}

variable "transcription_collection_throughput" {
  type    = number
  default = 400
}

variable "models_collection_name" {
  type    = string
  default = "models"
}

variable "models_collection_throughput" {
  type    = number
  default = 400
}

variable "storage_account_tier" {
  type    = string
  default = "Standard"
}

variable "storage_account_replication" {
  type    = string
  default = "LRS"
}

variable "audio_container_name" {
  type    = string
  default = "audio"
}

variable "code_container_name" {
  type    = string
  default = "code"
}

variable "code_blob_sas_expiry" {
  type    = string
  default = "48h"
}

variable "cognitive_services_sku_name" {
  type    = string
  default = "S0"
}

variable "cognitive_services_sku_tier" {
  type    = string
  default = "Standard"
}

variable "webapp_sku_size" {
  type    = string
  default = "S1"
}

variable "webapp_sku_tier" {
  type    = string
  default = "Standard"
}

variable "webapp_workers" {
  type    = number
  default = 1
}

variable "functionapp_sku_tier" {
  type    = string
  default = "ElasticPremium"
}

variable "functionapp_sku_size" {
  type    = string
  default = "EP1"
}

variable "functionapp_min_workers" {
  type    = number
  default = 1
}

variable "functionapp_max_workers" {
  type    = number
  default = 20
}
