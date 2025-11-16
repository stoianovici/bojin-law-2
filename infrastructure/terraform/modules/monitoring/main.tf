# Monitoring Module - Application Insights and Log Analytics
# Creates monitoring infrastructure for APM and centralized logging

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-${var.environment}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.retention_in_days

  tags = var.tags
}

resource "azurerm_application_insights" "main" {
  name                = "${var.project_name}-${var.environment}-appinsights"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"

  sampling_percentage = var.sampling_percentage

  tags = var.tags
}

# Diagnostic Settings for AKS (requires AKS cluster ID from parent)
# This will be configured at the root level using the output from this module

# Action Group for Alerts
resource "azurerm_monitor_action_group" "main" {
  name                = "${var.project_name}-${var.environment}-alerts"
  resource_group_name = var.resource_group_name
  short_name          = substr("${var.project_name}-${var.environment}", 0, 12)

  email_receiver {
    name                    = "ops-team"
    email_address           = var.alert_email_address
    use_common_alert_schema = true
  }

  tags = var.tags
}

# Metric Alert for High CPU Usage
resource "azurerm_monitor_metric_alert" "high_cpu" {
  count               = var.enable_alerts ? 1 : 0
  name                = "${var.project_name}-${var.environment}-high-cpu"
  resource_group_name = var.resource_group_name
  scopes              = [var.target_resource_id]
  description         = "Alert when CPU usage exceeds 80%"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_cpu_usage_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.tags
}

# Metric Alert for High Memory Usage
resource "azurerm_monitor_metric_alert" "high_memory" {
  count               = var.enable_alerts ? 1 : 0
  name                = "${var.project_name}-${var.environment}-high-memory"
  resource_group_name = var.resource_group_name
  scopes              = [var.target_resource_id]
  description         = "Alert when memory usage exceeds 85%"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_memory_working_set_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 85
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.tags
}
