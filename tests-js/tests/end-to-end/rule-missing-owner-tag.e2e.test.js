const { setupJestDefaultTimeout, generateIds, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
setupJestDefaultTimeout(30000);

test('rule: missing owner tag -> LOW violation and no remediation', async () => {
  const { kafka, logger } = createTestContext('rule-missing-owner-tag.e2e');
  const { ts } = generateIds('missing');
  const eventId = `evt-missing-${ts}`;
  const assetId = `asset-missingowner-${ts}`;

  const discoveryEvent = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    asset_id: assetId,
    asset_type: 'S3_BUCKET',
    cloud_provider: 'AWS',
    region: 'us-east-1',
    discovered_by: 'jest',
    metadata: { encryption_enabled: true, public_access: false, data_classification: 'INTERNAL', tags: {} }
  };

  const { relatedViolations, relatedRemediations } = await collectForDiscovery({ kafka, logger, discoveryEvent });

  expect(relatedViolations.length).toBeGreaterThanOrEqual(1);
  expect(relatedViolations.some(v => v.severity === 'LOW')).toBeTruthy();
  expect(relatedViolations.some(v => v.policy_name === 'Assets Must Have Owner Tag')).toBeTruthy();
  expect(relatedRemediations.length).toBe(0);

  
});
