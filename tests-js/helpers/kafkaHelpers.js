const { Kafka, logLevel, Partitioners } = require("kafkajs");

// Silence partitioner warning from KafkaJS
process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";

const createLogger = require("./logger");

/* =========================
   Kafka client
   ========================= */

function createKafka(brokers = ["localhost:9092"], clientId = "tests-js") {
  const logger = createLogger("createKafka");
  logger.info("creating Kafka client", { brokers, clientId });

  return new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.WARN,
  });
}

/* =========================
   Utilities
   ========================= */

function _safeJsonParse(buffer) {
  try {
    return JSON.parse(buffer.toString());
  } catch {
    return null;
  }
}

/* =========================
   Producer
   ========================= */

async function publishEvent(kafka, topic, event) {
  const logger = createLogger("publishEvent");
  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });

  try {
    await producer.connect();
    logger.info("sending message", { topic, eventId: event.event_id });

    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(event) }],
    });
  } catch (err) {
    logger.error("failed to publish event", err);
    throw err;
  } finally {
    await producer.disconnect().catch(() => {});
  }
}

/* =========================
   SINGLE Kafka collector engine
   ========================= */
async function _collectCore({
  kafka,
  topic,
  groupId,
  predicate = () => true,
  expectedCount = Infinity,
  timeoutMs = 5000,
  fromBeginning = false,
}) {
  const logger = createLogger("_collectCore");
  const consumer = kafka.consumer({ groupId });
  const messages = [];
  let finished = false;
  let timeoutId = null;

  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning });

    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        finished = true;
        resolve();
      }, timeoutMs);
    });

    const completion = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ message }) => {
          if (finished) return;

          const parsed = _safeJsonParse(message.value);
          if (!parsed || !predicate(parsed)) return;

          messages.push(parsed);
          logger.debug("message collected", {
            topic,
            count: messages.length,
          });

          if (messages.length >= expectedCount) {
            finished = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          }
        },
      });
    });

    await Promise.race([completion, timeoutPromise]);
    
    await new Promise(r => setTimeout(r, 50));

    logger.debug("collection complete", { topic, collected: messages.length });
    return messages;
  } catch (err) {
    logger.error("collection error", { topic, error: err.message });
    throw err;
  } finally {
    finished = true;
    if (timeoutId) clearTimeout(timeoutId);
    await consumer.stop().catch(() => {});
    await consumer.disconnect().catch(() => {});
  }
}


async function collectKafka({
  kafka,
  topics,
  predicate,
  expectedCount,
  timeoutMs = 5000,
  groupId = `tests-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 6)}`,
  fromBeginning = false,
}) {
  const logger = createLogger("collectKafka");

  const topicsMap =
    typeof topics === "string"
      ? { default: topics }
      : Array.isArray(topics)
      ? Object.fromEntries(topics.map((t) => [t, t]))
      : topics;

  const resolveOption = (opt, key, fallback) => {
    if (typeof opt === "function") return opt;
    if (opt && typeof opt === "object") return opt[key] ?? opt.default ?? fallback;
    return opt ?? fallback;
  };

  const collectors = Object.entries(topicsMap).map(([key, topic]) => ({
    key,
    promise: _collectCore({
      kafka,
      topic,
      groupId: `${groupId}-${key}`,
      predicate: resolveOption(predicate, key, () => true),
      expectedCount: resolveOption(expectedCount, key, Infinity),
      timeoutMs,
      fromBeginning,
    })
  }));

  try {
    const settled = await Promise.allSettled(collectors.map(c => c.promise));
    const results = {};
    
    settled.forEach((result, idx) => {
      const { key } = collectors[idx];
      if (result.status === 'fulfilled') {
        results[key] = result.value;
      } else {
        logger.error(`collector failed for ${key}`, result.reason);
        results[key] = [];
      }
    });

    return typeof topics === "string" ? results.default : results;
  } catch (err) {
    logger.error('unexpected error in collectors', err);
    throw err;
  }
}


function collectMessages(
  kafka,
  topic,
  { timeoutMs = 5000, groupId, fromBeginning } = {}
) {
  return collectKafka({
    kafka,
    topics: topic,
    timeoutMs,
    groupId,
    fromBeginning,
  });
}

function collectMatchingMessages(
  kafka,
  topic,
  predicate,
  expectedCount = 1,
  options = {}
) {
  return collectKafka({
    kafka,
    topics: topic,
    predicate,
    expectedCount,
    ...options,
  });
}

async function collectForDiscovery({
  kafka,
  logger,
  topics,
  collectOnly = ["discovery", "violations", "remediations"],
  timeoutMs = 5000,
}) {
  const _logger = logger || createLogger("collectForDiscovery");
  _logger.debug("collectForDiscovery", { collectOnly });

  const topicMap = {
    discovery: topics.discoveryTopic,
    violations: topics.violationsTopic,
    remediations: topics.remediationsTopic,
  };

  const filtered = Object.fromEntries(
    collectOnly.filter((k) => topicMap[k]).map((k) => [k, topicMap[k]])
  );

  const results = await collectKafka({
    kafka,
    topics: filtered,
    timeoutMs,
  });

  return {
    publishedDiscovery: results.discovery,
    relatedViolations: results.violations,
    relatedRemediations: results.remediations,
  };
}

/* =========================
   Convenience predicates
   ========================= */

function collectByEventId(kafka, topic, eventId, expectedCount = 1, options = {}) {
  return collectMatchingMessages(
    kafka,
    topic,
    (m) => m.event_id === eventId || m.source_event_id === eventId,
    expectedCount,
    options
  );
}

function collectByViolationType(
  kafka,
  topic,
  violationType,
  expectedCount = 1,
  options = {}
) {
  return collectMatchingMessages(
    kafka,
    topic,
    (m) => m.violation_type === violationType,
    expectedCount,
    options
  );
}

function collectByAssetRemediation(
  kafka,
  topic,
  assetId,
  remediationType,
  expectedCount = 1,
  options = {}
) {
  return collectMatchingMessages(
    kafka,
    topic,
    (m) => m.asset_id === assetId,
    expectedCount,
    options
  );
}

/* =========================
   Exports
   ========================= */

module.exports = {
  createKafka,
  publishEvent,
  collectKafka,
  collectMessages,
  collectMatchingMessages,
  collectForDiscovery,
  collectByEventId,
  collectByViolationType,
  collectByAssetRemediation,
  createLogger,
};
