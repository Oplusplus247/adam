const { setupJestDefaultTimeout, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
const { scenarios } = require('../../helpers/fixtures');
const { validateRemediationEvent } = require('../../helpers/validators');

setupJestDefaultTimeout(15000);

test('unit: public access yields DISABLE_PUBLIC_ACCESS remediation on remediation topic', async () => {
  const { kafka, logger } = createTestContext('unit-remediation');
  const discoveryEvent = scenarios.publicAccess();

  const { relatedRemediations } = await collectForDiscovery({ 
    kafka, 
    logger, 
    discoveryEvent, 
    timeoutMs: 6000 
  });

  expect(relatedRemediations.length).toBeGreaterThanOrEqual(1);
  
  const remediation = relatedRemediations[0];
  validateRemediationEvent(remediation, {
    asset_id: discoveryEvent.asset_id,
    remediation_type: 'DISABLE_PUBLIC_ACCESS',
    priority: 'HIGH',
    assigned_to: 'security-team',
  });
});