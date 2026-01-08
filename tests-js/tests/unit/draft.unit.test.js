const { setupJestDefaultTimeout, generateIds, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
setupJestDefaultTimeout(15000);

test('unit: public access yields DISABLE_PUBLIC_ACCESS remediation on remediation topic', async () => {
  const { kafka, logger } = createTestContext('unit-remediation');
  const { ts } = generateIds('rem');
  const eventId = `evt-rem-${ts}`;
  const assetId = `asset-rem-${ts}`;

  const discoveryEvent = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    asset_id: assetId,
    asset_type: 'S3_BUCKET',
    cloud_provider: 'AWS',
    region: 'us-east-1',
    discovered_by: 'jest',
    metadata: { encryption_enabled: true, public_access: true, data_classification: 'PII', tags: { owner: 'rem' } }
  };

  const { relatedViolations, relatedRemediations } = await collectForDiscovery({ kafka, logger, discoveryEvent, timeoutMs: 6000 });

  // verify remediation only as this is unit test
  
  expect(relatedRemediations.length).toBeGreaterThanOrEqual(1);
  const r = relatedRemediations[0];
  expect(r.remediation_type).toBe('DISABLE_PUBLIC_ACCESS');
  expect(r).toHaveProperty('violation_event_id');
  expect(r).toHaveProperty('priority', 'HIGH');
  expect(r).toHaveProperty('assigned_to', 'security-team');
});
