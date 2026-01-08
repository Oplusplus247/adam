/**
 * Test fixtures for consistent test data generation
 */

function createDiscoveryEvent(overrides = {}) {
  const ts = Date.now();
  const id = Math.random().toString(36).slice(2, 8);
  
  const defaults = {
    event_id: `evt-${ts}-${id}`,
    timestamp: new Date().toISOString(),
    asset_id: `asset-${ts}-${id}`,
    asset_type: 'S3_BUCKET',
    cloud_provider: 'AWS',
    region: 'us-east-1',
    discovered_by: 'jest',
    metadata: {
      encryption_enabled: true,
      public_access: false,
      data_classification: 'INTERNAL',
      tags: { owner: 'test' }
    }
  };

  return {
    ...defaults,
    ...overrides,
    metadata: {
      ...defaults.metadata,
      ...(overrides.metadata || {})
    }
  };
}

const scenarios = {
  compliant: () => createDiscoveryEvent({
    metadata: {
      encryption_enabled: true,
      public_access: false,
      data_classification: 'INTERNAL',
      tags: { owner: 'test' }
    }
  }),

  unencryptedPII: () => createDiscoveryEvent({
    metadata: {
      encryption_enabled: false,
      public_access: false,
      data_classification: 'PII',
      tags: { owner: 'test' }
    }
  }),

  unencryptedPCI: () => createDiscoveryEvent({
    metadata: {
      encryption_enabled: false,
      public_access: false,
      data_classification: 'PCI',
      tags: { owner: 'test' }
    }
  }),

  publicAccess: () => createDiscoveryEvent({
    metadata: {
      encryption_enabled: true,
      public_access: true,
      data_classification: 'INTERNAL',
      tags: { owner: 'test' }
    }
  }),

  missingOwnerTag: () => createDiscoveryEvent({
    metadata: {
      encryption_enabled: true,
      public_access: false,
      data_classification: 'INTERNAL',
      tags: {}
    }
  }),

  multipleViolations: () => createDiscoveryEvent({
    metadata: {
      encryption_enabled: false,
      public_access: true,
      data_classification: 'PII',
      tags: {}
    }
  }),
};

module.exports = {
  createDiscoveryEvent,
  scenarios,
};