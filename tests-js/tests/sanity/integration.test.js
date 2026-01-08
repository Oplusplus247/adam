const { setupJestDefaultTimeout, generateIds, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
setupJestDefaultTimeout(30000);

test('basic end-to-end: discovery -> violations (2) + remediation (1)', async () => {
  const { kafka, logger } = createTestContext('integration.test');
  const { ts } = generateIds('sanity');
  const eventId = `evt-test-${ts}`;
  const assetId = `asset-${ts}`;

  const discoveryEvent = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    asset_id: assetId,
    asset_type: 'S3_BUCKET',
    cloud_provider: 'AWS',
    region: 'us-east-1',
    discovered_by: 'jest',
    metadata: {
      encryption_enabled: false,
      public_access: false,
      data_classification: 'PII',
      tags: { owner: 'sanity' }
    }
  };

  const { publishedDiscovery, relatedViolations, relatedRemediations } = await collectForDiscovery({ kafka, logger, discoveryEvent });

  // Verify the discovery event was published to the input topic
  expect(publishedDiscovery.length).toBeGreaterThanOrEqual(1);
  expect(publishedDiscovery.some(d => d.event_id === eventId && d.asset_id === assetId)).toBeTruthy();
  expect(relatedViolations.length).toBeGreaterThanOrEqual(1);
  expect(relatedRemediations.length).toBeGreaterThanOrEqual(1);
});
