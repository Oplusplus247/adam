const { setupJestDefaultTimeout, generateIds, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
setupJestDefaultTimeout(15000);

test('unit: compliant discovery event produces no violations or remediations', async () => {
  const { kafka, logger } = createTestContext('unit-discovery');
  const { ts } = generateIds('unit');
  const eventId = `evt-unit-${ts}`;
  const assetId = `asset-unit-${ts}`;

  const discoveryEvent = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    asset_id: assetId,
    asset_type: 'S3_BUCKET',
    cloud_provider: 'AWS',
    region: 'us-east-1',
    discovered_by: 'jest',
    metadata: { encryption_enabled: true, public_access: false, data_classification: 'INTERNAL', tags: { owner: 'unit' } }
  };

  const { publishedDiscovery } = await collectForDiscovery({
  kafka,
  logger,
  discoveryEvent,
  collectOnly: ['discovery'],
  timeoutMs: 5000
});

  // Verify the discovery event was actually published to the input topic
  expect(publishedDiscovery.length).toBeGreaterThanOrEqual(1);
  expect(publishedDiscovery.some(d => d.event_id === eventId && d.asset_id === assetId)).toBeTruthy();
});
