const { setupJestDefaultTimeout, createTestContext, collectForDiscovery } = require('../../helpers/testBase');
const { scenarios } = require('../../helpers/fixtures');
const { validateViolationEvent, validateRemediationEvent, validateEventCorrelation } = require('../../helpers/validators');

setupJestDefaultTimeout(30000);

test('use-case: public access -> HIGH violation + DISABLE_PUBLIC_ACCESS remediation', async () => {
  const { kafka, logger } = createTestContext('public-access-remediation.test');
  const discoveryEvent = scenarios.publicAccess();

  const { relatedViolations, relatedRemediations } = await collectForDiscovery({ 
    kafka, 
    logger, 
    discoveryEvent 
  });

  expect(relatedViolations.length).toBeGreaterThanOrEqual(1);
  expect(relatedRemediations.length).toBeGreaterThanOrEqual(1);

  const publicAccessViolation = relatedViolations.find(v => v.violation_type === 'PUBLIC_ACCESS_ENABLED');
  expect(publicAccessViolation).toBeDefined();
  validateViolationEvent(publicAccessViolation, {
    severity: 'HIGH',
    asset_id: discoveryEvent.asset_id,
  });

  const remediation = relatedRemediations.find(r => r.remediation_type === 'DISABLE_PUBLIC_ACCESS');
  expect(remediation).toBeDefined();
  validateRemediationEvent(remediation, {
    priority: 'HIGH',
    assigned_to: 'security-team',
  });

  // Verify correlation
  validateEventCorrelation(discoveryEvent, publicAccessViolation, remediation);
});