const { setupJestDefaultTimeout, createTestContext, INPUT_TOPIC, VIOLATION_TOPIC } = require('../../helpers/testBase');
const { collectForDiscovery: collectKafkaForDiscovery, publishEvent } = require('../../helpers/kafkaHelpers');
const { createDiscoveryEvent, scenarios } = require('../../helpers/fixtures');
const { validateViolationEvent } = require('../../helpers/validators');

setupJestDefaultTimeout(15000);

test('unit: missing owner tag yields LOW violation on violation topic', async () => {
  const { kafka, logger } = createTestContext('unit-violation');
  const discoveryEvent = scenarios.missingOwnerTag();

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
  
  const violation = relatedViolations.find(v => v.severity === 'LOW');
  expect(violation).toBeDefined();
  
  validateViolationEvent(violation, {
    asset_id: discoveryEvent.asset_id,
    violation_type: 'MISSING_OWNER_TAG',
    severity: 'LOW',
    source_event_id: discoveryEvent.event_id,
  });
});