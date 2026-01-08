const { setupJestDefaultTimeout, generateIds, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
setupJestDefaultTimeout(30000);

test('use-case: public access -> HIGH violation + DISABLE_PUBLIC_ACCESS remediation', async () => {
  const { kafka, logger } = createTestContext('public-access-remediation.test');
  const { ts } = generateIds('public');
  const eventId = `evt-public-${ts}`;
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
      encryption_enabled: true,
      public_access: true,
      data_classification: 'PII',
      tags: { owner: 'team-a' },
    },
  };

  const { relatedViolations, relatedRemediations } = await collectForDiscovery({ kafka, logger, discoveryEvent });

  expect(relatedViolations.length).toBeGreaterThanOrEqual(1);
  expect(relatedRemediations.length).toBeGreaterThanOrEqual(1);
  expect(relatedRemediations[0].remediation_type).toBe('DISABLE_PUBLIC_ACCESS');
  expect(relatedRemediations[0].violation_event_id).toBeDefined();
  expect(relatedViolations.some(v => v.event_id === relatedRemediations[0].violation_event_id)).toBeTruthy();
  expect(relatedRemediations[0].priority).toBe('HIGH');
  expect(relatedRemediations[0].assigned_to).toBe('security-team');
});
