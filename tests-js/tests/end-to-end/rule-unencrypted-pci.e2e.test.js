const { setupJestDefaultTimeout, generateIds, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
setupJestDefaultTimeout(30000);

test('rule: unencrypted PCI -> CRITICAL violation + ENABLE_ENCRYPTION remediation', async () => {
  const { kafka, logger } = createTestContext('rule-unencrypted-pci.e2e');
  const { ts } = generateIds('pci');
  const eventId = `evt-pci-${ts}`;
  const assetId = `asset-pci-${ts}`;

  const discoveryEvent = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    asset_id: assetId,
    asset_type: 'S3_BUCKET',
    cloud_provider: 'AWS',
    region: 'us-east-1',
    discovered_by: 'jest',
    metadata: { encryption_enabled: false, public_access: false, data_classification: 'PCI', tags: { owner: 'security' } }
  };

  const { relatedViolations, relatedRemediations } = await collectForDiscovery({ kafka, logger, discoveryEvent });

  expect(relatedViolations.length).toBeGreaterThanOrEqual(1);
  expect(relatedRemediations.length).toBeGreaterThanOrEqual(1);
  expect(relatedViolations.some(v => v.severity === 'CRITICAL')).toBeTruthy();
  expect(relatedRemediations.some(r => r.remediation_type === 'ENABLE_ENCRYPTION')).toBeTruthy();
});
