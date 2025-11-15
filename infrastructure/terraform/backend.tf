terraform {
  backend "azurerm" {
    resource_group_name  = "legal-platform-tfstate-rg"
    storage_account_name = "legalplatformtfstate"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}