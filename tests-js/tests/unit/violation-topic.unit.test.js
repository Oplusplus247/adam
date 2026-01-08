const { setupJestDefaultTimeout, generateIds, createTestContext, INPUT_TOPIC, VIOLATION_TOPIC } = require('../../helpers/testBase');
const { collectForDiscovery: collectKafkaForDiscovery, publishEvent } = require('../../helpers/kafkaHelpers');
setupJestDefaultTimeout(15000);

test('unit: missing owner tag yields LOW violation on violation topic', async () => {
  const { kafka, logger } = createTestContext('unit-violation');
  const { ts } = generateIds('vio');
  const eventId = `evt-vio-${ts}`;
  const assetId = `asset-vio-${ts}`;

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

  const collectionPromise = collectKafkaForDiscovery({
    kafka,
    logger,
    topics: {
      discoveryTopic: INPUT_TOPIC,
      violationsTopic: VIOLATION_TOPIC,
    },
    collectOnly: ['discovery', 'violations'],
    timeoutMs: 6000,
  });

  await new Promise((r) => setTimeout(r, 400));
  await publishEvent(kafka, INPUT_TOPIC, discoveryEvent);

  const { relatedViolations } = await collectionPromise;

  expect(relatedViolations.length).toBeGreaterThanOrEqual(1);
  expect(relatedViolations.some(v => v.severity === 'LOW')).toBeTruthy();
  const v = relatedViolations[0];
  expect(v).toHaveProperty('event_id');
  expect(v).toHaveProperty('asset_id', assetId);
  expect(v).toHaveProperty('violation_type', 'MISSING_OWNER_TAG');
  expect(v).toHaveProperty('severity', 'LOW');
  expect(v).toHaveProperty('source_event_id', eventId);
});
