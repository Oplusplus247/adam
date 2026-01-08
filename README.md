## Overview

This repository provides:
- A mock DSPM Policy Engine and Kafka stack (via Docker Compose) to simulate the event-driven flow.
- A Jest-based automated test framework that publishes discovery events and validates violations/remediations emitted by the Policy Engine.

Event flow: Asset Discovery → Policy Engine → Policy Violations → Remediation Requests.

Kafka topics:
- dspm.discovery.asset (input)
- dspm.policy.violation (output)
- dspm.remediation.requested (output)

The tests cover unit-like, sanity, and end-to-end scenarios, validate event structure and correlation, and generate JSON reports.

## Prerequisites

Install and verify the following:
- Docker Desktop (includes Docker Compose): https://docs.docker.com/get-docker/
- Node.js 18+ and npm: https://nodejs.org/

Verify installations:
```bash
docker --version
docker-compose --version
node --version
npm --version
```

Notes:
- Python dependencies for the mock service are installed inside the container automatically — no local Python setup required.

## Start the Infrastructure

From the project root:
```bash
docker-compose up -d
```
Allow ~30 seconds for services to initialize.

Verify the mock service:
```bash
docker-compose logs -f mock-dspm-service
# Expect: "Mock DSPM Service started successfully"
```

Kafka quick commands:
```bash
# List topics
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Consume violations (Ctrl+C to stop)
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic dspm.policy.violation \
  --from-beginning

# Consume remediations
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic dspm.remediation.requested \
  --from-beginning
```

Stop everything:
```bash
docker-compose down
```

## Run the Tests

Install test dependencies once:
```bash
cd tests-js
npm install
```

Run all tests (serial, stable for Kafka):
```bash
npm test
```

Run a specific folder/suite:
```bash
# Unit tests
npm test -- tests/unit

# End-to-end tests
npm test -- tests/end-to-end

# Sanity tests
npm test -- tests/sanity
```

Run a single test file:
```bash
npm test -- tests/unit/violation-topic.unit.test.js
```

Filter by test name (regex):
```bash
npm test -- -t "public access"
```

Useful Jest flags for async/Kafka debugging:
```bash
# Detect open handles to surface hanging consumers
npm test -- --detectOpenHandles

# Watch mode (handy when iterating on tests)
npm test -- --watch
```

### Log Levels and Test Diagnostics

Tests use a lightweight logger with an env-configurable minimum level. This helps when investigating timing/ordering issues in distributed flows.

Supported levels: `debug`, `info` (default), `warn`, `error`.

Windows PowerShell examples:
```powershell
$env:TEST_LOG_LEVEL = 'debug'; npm test                # verbose diagnostics
$env:TEST_LOG_LEVEL = 'info';  npm test -- tests/unit   # quieter, default

# Optional: write error stacks to files in test-logs/
$env:TEST_LOG_TO_FILE = '1'; $env:TEST_LOG_DIR = 'test-logs'; npm test
```

Bash examples:
```bash
TEST_LOG_LEVEL=debug npm test
TEST_LOG_LEVEL=info  npm test -- tests/end-to-end
TEST_LOG_TO_FILE=1 TEST_LOG_DIR=test-logs npm test
```

Why adjust the level?
- `debug`: inspect event collection timing, consumer start/stop, and correlation logic.
- `info`: default signal without noise for routine runs.
- `warn`/`error`: surface only problems in CI or quick checks.

### JSON Test Reports

Jest is configured with a custom JSON reporter that emits a machine-readable summary for automated reporting and CI artifacts.

- Output directory: `tests-js/test-logs` by default.
- File name: `test-report-<runId>.json`.
- Configure with env vars:
  - `TEST_RUN_ID`: set a stable ID for CI runs.
  - `TEST_REPORT_DIR`: override output directory.

Examples:
```powershell
$env:TEST_RUN_ID = 'ci-123'; npm test
$env:TEST_REPORT_DIR = 'C:\\temp\\reports'; npm test
```

See example output in the repository under `tests-js/test-logs/`.

## High-Level Test Plan

- Objectives: Validate the Policy Engine’s behavior given discovery inputs, ensuring correct violations/remediations, severity mapping, and event correlation.
- Layers:
  - Unit-like: narrow scenarios per topic and rule (fast feedback).
  - Sanity: minimal E2E health of the whole flow.
  - End-to-end: realistic use-cases across discovery → violation → remediation.
- Validations:
  - Event structure: required fields present on discovery/violation/remediation messages.
  - Business logic: severity, remediation type, and critical-path conditions.
  - Timing: joins/collection windows with safe timeouts and serial test execution.
  - Correlation: `source_event_id` and `asset_id` linkages across topics.

## Project Structure

- mock-dspm-service/: Python mock service (containerized) that reads discovery events and emits violations/remediations.
- tests-js/: Jest tests, helpers, Kafka utilities, and custom reporter.
  - helpers/kafkaHelpers.js: Kafka client, publish/collect utilities with error handling.
  - helpers/testBase.js: Test context, topic constants, and collection orchestrator.
  - helpers/logger.js: Env-configurable logging and optional file-based error stacks.
  - reporters/simpleJsonReporter.js: JSON report emitter.
  - tests/…: unit, sanity, and end-to-end suites.

## Error Handling and Stability

- Producers/consumers use defensive `try/finally` with disconnect guards to avoid dangling handles.
- Collection helpers time out gracefully and return what was captured.
- Logging never throws; file logging failures are swallowed so tests don’t crash.
- Tests run `--runInBand` to avoid interleaved Kafka consumers.


