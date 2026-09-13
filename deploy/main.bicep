@description('Deploy to a new resource group and a fresh database. Run migrations separately from a VNet-connected runner.')
param location string = resourceGroup().location
param prefix string
param publicOrigin string
param image string
param registryName string
param keyVaultName string
param databaseSecretUri string
param redditSecretUri string
param redditClientId string
param redditUserAgent string
param sqlAdministrator string
@secure()
param sqlAdministratorPassword string

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: registryName }
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = { name: keyVaultName }
resource network 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: '${prefix}-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.42.0.0/16'] }
    subnets: [
      { name: 'app', properties: { addressPrefix: '10.42.1.0/24', delegations: [{ name: 'web', properties: { serviceName: 'Microsoft.Web/serverFarms' } }] } }
      { name: 'sql', properties: { addressPrefix: '10.42.2.0/24', privateEndpointNetworkPolicies: 'Disabled' } }
    ]
  }
}
resource sql 'Microsoft.Sql/servers@2023-08-01' = {
  name: '${prefix}-sql'
  location: location
  properties: { administratorLogin: sqlAdministrator, administratorLoginPassword: sqlAdministratorPassword, minimalTlsVersion: '1.2', publicNetworkAccess: 'Disabled' }
}
resource database 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sql
  name: 'FantasyReddit'
  location: location
  sku: { name: 'S1', tier: 'Standard' }
  properties: { collation: 'SQL_Latin1_General_CP1_CI_AS', zoneRedundant: false }
}
resource backup 'Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies@2023-08-01' = {
  parent: database
  name: 'default'
  properties: { retentionDays: 14 }
}
resource dns 'Microsoft.Network/privateDnsZones@2020-06-01' = { name: 'privatelink${environment().suffixes.sqlServerHostname}', location: 'global' }
resource link 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dns
  name: '${prefix}-sql-link'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: network.id } }
}
resource endpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-sql-endpoint'
  location: location
  properties: { subnet: { id: '${network.id}/subnets/sql' }, privateLinkServiceConnections: [{ name: 'sql', properties: { privateLinkServiceId: sql.id, groupIds: ['sqlServer'] } }] }
}
resource dnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: endpoint
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'sql', properties: { privateDnsZoneId: dns.id } }] }
}
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-plan'
  location: location
  kind: 'linux'
  sku: { name: 'P1v3', tier: 'PremiumV3', capacity: 1 }
  properties: { reserved: true }
}
resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-app'
  location: location
  kind: 'app,linux,container'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: '${network.id}/subnets/app'
    vnetRouteAllEnabled: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${registry.properties.loginServer}/${image}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      healthCheckPath: '/api/health/ready'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '8080' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '8080' }
        { name: 'PUBLIC_ORIGIN', value: publicOrigin }
        { name: 'DB_CONNECTION_STRING', value: '@Microsoft.KeyVault(SecretUri=${databaseSecretUri})' }
        { name: 'REDDIT_CLIENT_SECRET', value: '@Microsoft.KeyVault(SecretUri=${redditSecretUri})' }
        { name: 'REDDIT_CLIENT_ID', value: redditClientId }
        { name: 'REDDIT_USER_AGENT', value: redditUserAgent }
        { name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES', value: '3' }
      ]
    }
  }
}
resource pullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, app.id, 'AcrPull')
  scope: registry
  properties: { principalId: app.identity.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') }
}
resource secretRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, app.id, 'SecretsUser')
  scope: vault
  properties: { principalId: app.identity.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') }
}
output appName string = app.name
output databaseHost string = sql.properties.fullyQualifiedDomainName
output migrationSubnet string = '${network.id}/subnets/sql'
