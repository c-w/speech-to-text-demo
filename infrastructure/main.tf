provider "azurerm" {
  version         = "=1.36.1"
  subscription_id = var.subscription_id
}

resource "azurerm_resource_group" "minio_resource_group" {
  name     = "${var.prefix}minio"
  location = var.location
  tags     = { "${var.tag_name}" = var.prefix }
}

resource "azurerm_resource_group" "svc_resource_group" {
  name     = "${var.prefix}svc"
  location = var.location
  tags     = { "${var.tag_name}" = var.prefix }
}

resource "azurerm_storage_account" "data_storage_account" {
  resource_group_name      = azurerm_resource_group.svc_resource_group.name
  location                 = azurerm_resource_group.svc_resource_group.location
  name                     = "${var.prefix}data"
  account_kind             = "StorageV2"
  account_tier             = var.storage_account_tier
  account_replication_type = var.storage_account_replication
}

resource "azurerm_storage_container" "audio_container" {
  storage_account_name = azurerm_storage_account.data_storage_account.name
  name                 = var.audio_container_name
}

resource "azurerm_storage_container" "transcription_container" {
  storage_account_name = azurerm_storage_account.data_storage_account.name
  name                 = var.transcription_container_name
}

resource "azurerm_storage_container" "code_container" {
  storage_account_name = azurerm_storage_account.data_storage_account.name
  name                 = var.code_container_name
}

resource "azurerm_storage_blob" "code_blob" {
  storage_account_name   = azurerm_storage_account.data_storage_account.name
  storage_container_name = azurerm_storage_container.code_container.name
  name                   = "code-${filesha256(var.code_zip)}.zip"
  type                   = "Block"
  source                 = var.code_zip
}

data "azurerm_storage_account_sas" "code_blob_sas" {
  connection_string = azurerm_storage_account.data_storage_account.primary_connection_string

  start  = formatdate("YYYY-MM-DD", timeadd(timestamp(), "-${var.code_blob_sas_expiry}"))
  expiry = formatdate("YYYY-MM-DD", timeadd(timestamp(), var.code_blob_sas_expiry))

  resource_types {
    service   = false
    container = false
    object    = true
  }

  services {
    blob  = true
    queue = false
    table = false
    file  = false
  }

  permissions {
    read    = true
    write   = false
    delete  = false
    list    = false
    add     = false
    create  = false
    update  = false
    process = false
  }
}

resource "azurerm_cognitive_account" "speech_to_text" {
  resource_group_name = azurerm_resource_group.svc_resource_group.name
  location            = azurerm_resource_group.svc_resource_group.location
  name                = "${var.prefix}stt"
  kind                = "SpeechServices"
  sku {
    name = var.cognitive_services_sku_name
    tier = var.cognitive_services_sku_tier
  }
}

resource "azurerm_app_service_plan" "minio_hosting" {
  resource_group_name = azurerm_resource_group.minio_resource_group.name
  location            = azurerm_resource_group.minio_resource_group.location
  name                = "${var.prefix}minio"
  kind                = "Linux"
  reserved            = true
  sku {
    tier     = var.webapp_sku_tier
    size     = var.webapp_sku_size
    capacity = var.webapp_workers
  }
}

resource "azurerm_app_service" "minio_app" {
  resource_group_name = azurerm_resource_group.minio_resource_group.name
  location            = azurerm_resource_group.minio_resource_group.location
  name                = "${var.prefix}minio"
  app_service_plan_id = azurerm_app_service_plan.minio_hosting.id

  app_settings = {
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = false
    WEBSITES_PORT                       = "9000"
    MINIO_ACCESS_KEY                    = azurerm_storage_account.data_storage_account.name
    MINIO_SECRET_KEY                    = azurerm_storage_account.data_storage_account.primary_access_key
  }

  site_config {
    always_on        = true
    linux_fx_version = "DOCKER|cwolff/minio:latest"
    app_command_line = "minio gateway azure ${azurerm_storage_account.data_storage_account.primary_blob_endpoint}"
  }
}

resource "azurerm_app_service_plan" "svc_hosting" {
  resource_group_name          = azurerm_resource_group.svc_resource_group.name
  location                     = azurerm_resource_group.svc_resource_group.location
  name                         = "${var.prefix}func"
  kind                         = "elastic"
  maximum_elastic_worker_count = var.functionapp_max_workers

  sku {
    tier     = var.functionapp_sku_tier
    size     = var.functionapp_sku_size
    capacity = var.functionapp_min_workers
  }
}

resource "azurerm_application_insights" "svc_logs" {
  resource_group_name = azurerm_resource_group.svc_resource_group.name
  location            = azurerm_resource_group.svc_resource_group.location
  name                = "${var.prefix}func"
  application_type    = "web"
}

resource "azurerm_function_app" "svc_app" {
  resource_group_name       = azurerm_resource_group.svc_resource_group.name
  location                  = azurerm_resource_group.svc_resource_group.location
  name                      = "${var.prefix}func"
  app_service_plan_id       = azurerm_app_service_plan.svc_hosting.id
  storage_connection_string = azurerm_storage_account.data_storage_account.primary_connection_string
  version                   = "~2"

  app_settings = {
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.svc_logs.instrumentation_key
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTIONS_EXTENSION_VERSION    = "~2"
    WEBSITE_NODE_DEFAULT_VERSION   = "~10"
    HASH                           = filesha256(var.code_zip)
    WEBSITE_USE_ZIP                = "${azurerm_storage_blob.code_blob.url}${data.azurerm_storage_account_sas.code_blob_sas.sas}"

    TRANSCRIPTION_CONTAINER = azurerm_storage_container.transcription_container.name
    SPEECH_SERVICE_KEY      = azurerm_cognitive_account.speech_to_text.primary_access_key
    SPEECH_SERVICE_ENDPOINT = "https://${azurerm_cognitive_account.speech_to_text.location}.cris.ai"
    AUDIO_STORAGE           = azurerm_storage_account.data_storage_account.primary_connection_string
  }
}

resource "azurerm_eventgrid_event_subscription" "svc_sub" {
  name                 = "${var.prefix}sub"
  scope                = azurerm_storage_account.data_storage_account.id
  included_event_types = ["Microsoft.Storage.BlobCreated"]

  subject_filter {
    subject_begins_with = "/blobServices/default/containers/${azurerm_storage_container.audio_container.name}/blobs/"
  }

  webhook_endpoint {
    url = "https://${azurerm_function_app.svc_app.default_hostname}/runtime/webhooks/EventGrid?functionName=OnAudioUploaded&code=${lookup(azurerm_template_deployment.svc_keys.outputs, "eventgridKey")}"
  }
}

// TODO: remove when https://github.com/terraform-providers/terraform-provider-azurerm/issues/699 is implemented
resource "azurerm_template_deployment" "svc_keys" {
  resource_group_name = azurerm_resource_group.svc_resource_group.name
  name                = "${var.prefix}svc"

  parameters      = { "functionApp" = azurerm_function_app.svc_app.name }
  deployment_mode = "Incremental"
  template_body   = <<BODY
  {
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
      "functionApp": {"type": "string", "defaultValue": ""}
    },
    "variables": {
      "functionAppId": "[resourceId('Microsoft.Web/sites', parameters('functionApp'))]"
    },
    "resources": [],
    "outputs": {
      "eventgridKey": {
        "type": "string",
        "value": "[listkeys(concat(variables('functionAppId'), '/host/default'), '2018-11-01').systemKeys.eventgrid_extension]"
      }
    }
  }
  BODY
}