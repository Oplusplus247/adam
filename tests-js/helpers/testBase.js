const { createKafka, publishEvent, collectMessages } = require('./kafkaHelpers');
const createLogger = require('./logger');

const DEFAULT_JOIN_DELAY_MS = 400;
const DEFAULT_COLLECT_TIMEOUT_MS = 7000;
const INPUT_TOPIC = 'dspm.discovery.asset';
const VIOLATION_TOPIC = 'dspm.policy.violation';
const REMEDIATION_TOPIC = 'dspm.remediation.requested';

function setupJestDefaultTimeout(ms = 30000) {
  try { jest.setTimeout(ms); } catch (_) { /* ignore outside jest */ }
}

function generateIds(prefix = '') {
  const ts = Date.now();
  return {
    ts,
    eventId: `evt-${prefix ? prefix + '-' : ''}${ts}`,
    assetId: `asset-${prefix ? prefix + '-' : ''}${ts}`,
  };
}

function createTestContext(name = 'default.test') {
  const kafka = createKafka();
  const logger = createLogger(name);
  return { kafka, logger };
}

async function collectForDiscovery({
  kafka,
  logger,
  discoveryEvent,
  collectOnly = ['discovery', 'violations', 'remediations'],
  joinDelayMs = DEFAULT_JOIN_DELAY_MS,
  timeoutMs = DEFAULT_COLLECT_TIMEOUT_MS,
}) {
  const topicMap = {
    discovery: INPUT_TOPIC,
    violations: VIOLATION_TOPIC,
    remediations: REMEDIATION_TOPIC,
  };

  // Build active collectors only
  const activeTopics = Object.fromEntries(
    collectOnly
      .filter((k) => topicMap[k])
      .map((k) => [k, topicMap[k]])
  );

  logger.info('starting collectors', {
    activeCollectors: Object.keys(activeTopics),
    topics: activeTopics,
  });

  const collectors = {};
  for (const [key, topic] of Object.entries(activeTopics)) {
    collectors[key] = collectMessages(kafka, topic, { timeoutMs });
  }

  await new Promise((r) => setTimeout(r, joinDelayMs));

  const { event_id: eventId, asset_id: assetId } = discoveryEvent;
  logger.info('publishing discovery event', { eventId, assetId });
  await publishEvent(kafka, INPUT_TOPIC, discoveryEvent);

  const results = {};
  for (const [key, promise] of Object.entries(collectors)) {
    results[key] = await promise;
  }

  const publishedDiscovery = (results.discovery || []).filter(
    (d) => d.event_id === eventId
  );

  const relatedViolations = (results.violations || []).filter(
    (v) => v.source_event_id === eventId
  );

  const relatedRemediations = (results.remediations || []).filter(
    (r) => r.asset_id === assetId
  );

  logger.info('collection complete', {
    publishedDiscovery: publishedDiscovery.length,
    relatedViolations: relatedViolations.length,
    relatedRemediations: relatedRemediations.length,
  });

  return {
    publishedDiscovery,
    relatedViolations,
    relatedRemediations,
    discWindow: results.discovery,
    vioWindow: results.violations,
    remWindow: results.remediations,
  };
}


module.exports = {
  setupJestDefaultTimeout,
  generateIds,
  createTestContext,
  collectForDiscovery,
  DEFAULT_JOIN_DELAY_MS,
  DEFAULT_COLLECT_TIMEOUT_MS,
  INPUT_TOPIC,
  VIOLATION_TOPIC,
  REMEDIATION_TOPIC,
};
