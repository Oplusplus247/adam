const { setupJestDefaultTimeout, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
const { scenarios } = require('../../helpers/fixtures');
const { validateDiscoveryEvent, validateViolationEvent, validateRemediationEvent } = require('../../helpers/validators');

setupJestDefaultTimeout(30000);

test('basic end-to-end: discovery -> violations + remediation', async () => {
  const { kafka, logger } = createTestContext('integration.test');
  const discoveryEvent = scenarios.unencryptedPII();

  const { publishedDiscovery, relatedViolations, relatedRemediations } = await collectForDiscovery({ 
    kafka, 
    logger, 
    discoveryEvent 
  });

  // Verify discovery event was published
  expect(publishedDiscovery.length).toBeGreaterThanOrEqual(1);
  const ourDiscovery = publishedDiscovery.find(d => d.event_id === discoveryEvent.event_id);
  expect(ourDiscovery).toBeDefined();
  validateDiscoveryEvent(ourDiscovery);

  // Verify violations
  expect(relatedViolations.length).toBeGreaterThanOrEqual(1);
  const violation = relatedViolations[0];
  validateViolationEvent(violation, {
    asset_id: discoveryEvent.asset_id,
    source_event_id: discoveryEvent.event_id,
  });

  // Verify remediations
  expect(relatedRemediations.length).toBeGreaterThanOrEqual(1);
  const remediation = relatedRemediations[0];
  validateRemediationEvent(remediation, {
    asset_id: discoveryEvent.asset_id,
  });
});