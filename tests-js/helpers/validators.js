/**
 * Schema validators for event structures
 */

function validateDiscoveryEvent(event, expectedFields = {}) {
  expect(event).toHaveProperty('event_id');
  expect(event).toHaveProperty('timestamp');
  expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(event).toHaveProperty('asset_id');
  expect(event).toHaveProperty('asset_type');
  expect(event).toHaveProperty('cloud_provider');
  expect(event).toHaveProperty('region');
  expect(event).toHaveProperty('discovered_by');
  expect(event).toHaveProperty('metadata');
  expect(event.metadata).toHaveProperty('encryption_enabled');
  expect(event.metadata).toHaveProperty('public_access');
  expect(event.metadata).toHaveProperty('data_classification');
  expect(event.metadata).toHaveProperty('tags');
  
  Object.entries(expectedFields).forEach(([key, value]) => {
    expect(event[key]).toBe(value);
  });
  
  return event;
}

function validateViolationEvent(violation, expectedFields = {}) {
  expect(violation).toHaveProperty('event_id');
  expect(violation.event_id).toMatch(/^evt_violation_/);
  expect(violation).toHaveProperty('timestamp');
  expect(violation.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(violation).toHaveProperty('asset_id');
  expect(violation).toHaveProperty('violation_type');
  expect(violation).toHaveProperty('severity');
  expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(violation.severity);
  expect(violation).toHaveProperty('policy_id');
  expect(violation).toHaveProperty('policy_name');
  expect(violation).toHaveProperty('description');
  expect(violation).toHaveProperty('source_event_id');
  
  Object.entries(expectedFields).forEach(([key, value]) => {
    expect(violation[key]).toBe(value);
  });
  
  return violation;
}

function validateRemediationEvent(remediation, expectedFields = {}) {
  expect(remediation).toHaveProperty('event_id');
  expect(remediation.event_id).toMatch(/^evt_remediation_/);
  expect(remediation).toHaveProperty('timestamp');
  expect(remediation.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(remediation).toHaveProperty('asset_id');
  expect(remediation).toHaveProperty('violation_event_id');
  expect(remediation.violation_event_id).toMatch(/^evt_violation_/);
  expect(remediation).toHaveProperty('remediation_type');
  expect(remediation).toHaveProperty('priority');
  expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(remediation.priority);
  expect(remediation).toHaveProperty('auto_remediate');
  expect(typeof remediation.auto_remediate).toBe('boolean');
  expect(remediation).toHaveProperty('assigned_to');
  expect(remediation).toHaveProperty('due_date');
  
  Object.entries(expectedFields).forEach(([key, value]) => {
    expect(remediation[key]).toBe(value);
  });
  
  return remediation;
}

function validateEventCorrelation(discovery, violation, remediation) {
  expect(violation.source_event_id).toBe(discovery.event_id);
  expect(violation.asset_id).toBe(discovery.asset_id);
  
  expect(remediation.violation_event_id).toBe(violation.event_id);
  expect(remediation.asset_id).toBe(discovery.asset_id);
}

module.exports = {
  validateDiscoveryEvent,
  validateViolationEvent,
  validateRemediationEvent,
  validateEventCorrelation,
};