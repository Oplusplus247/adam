const { createKafka, publishEvent, collectMessages } = require('./kafkaHelpers');
const createLogger = require('./logger');

const DEFAULT_JOIN_DELAY_MS = 400;
const DEFAULT_COLLECT_TIMEOUT_MS = 7000;
const INPUT_TOPIC = 'dspm.discovery.asset';
const VIOLATION_TOPIC = 'dspm.policy.violation';
const REMEDIATION_TOPIC = 'dspm.remediation.requested';

let testCounter = 0;

function setupJestDefaultTimeout(ms = 30000) {
  try { jest.setTimeout(ms); } catch (_) { /* ignore outside jest */ }
}

function generateIds(prefix = '') {
  const ts = Date.now();
  const counter = testCounter++;
  return {
    ts,
    counter,
    eventId: `evt-${prefix ? prefix + '-' : ''}${ts}-${counter}`,
    assetId: `asset-${prefix ? prefix + '-' : ''}${ts}-${counter}`,
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
  const startTime = Date.now();
  
  const topicMap = {
    discovery: INPUT_TOPIC,
    violations: VIOLATION_TOPIC,
    remediations: REMEDIATION_TOPIC,
  };

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
  try {
    for (const [key, topic] of Object.entries(activeTopics)) {
      collectors[key] = collectMessages(kafka, topic, { timeoutMs });
    }

    await new Promise((r) => setTimeout(r, joinDelayMs));

    const { event_id: eventId, asset_id: assetId } = discoveryEvent;
    logger.info('publishing discovery event', { eventId, assetId });
    await publishEvent(kafka, INPUT_TOPIC, discoveryEvent);

    const results = {};
    for (const [key, promise] of Object.entries(collectors)) {
      try {
        results[key] = await promise;
      } catch (err) {
        logger.error(`collector ${key} failed`, err);
        results[key] = [];
      }
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

    const duration = Date.now() - startTime;
    logger.info('collection complete', {
      duration,
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
      metrics: {
        duration,
        avgProcessingTime: duration / Math.max(relatedViolations.length, 1)
      }
    };
  } catch (err) {
    logger.error('collection failed', err);
    throw err;
  }
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
