// simpleJsonReporter.js
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = class SimpleJsonReporter {
  constructor(globalConfig, options) {
    this._options = options || {};
    this._runId = process.env.TEST_RUN_ID || `run-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    this._outDir = process.env.TEST_REPORT_DIR || (this._options.outDir || path.join(process.cwd(), 'test-logs'));
    ensureDir(this._outDir);
    this._report = {
      runId: this._runId,
      startTime: new Date().toISOString(),
      nodeVersion: process.version,
      stats: { suites: 0, tests: 0, passed: 0, failed: 0, pending: 0 },
      files: [],
      meta: {
        logDir: process.env.TEST_LOG_DIR || path.join(process.cwd(), 'test-logs'),
      }
    };
  }

  onTestResult(test, testResult) {
    this._report.stats.suites += 1;
    this._report.stats.tests += testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests;
    this._report.stats.passed += testResult.numPassingTests;
    this._report.stats.failed += testResult.numFailingTests;
    this._report.stats.pending += testResult.numPendingTests;

    const fileSummary = {
      filePath: test.path,
      duration: testResult.perfStats?.end - testResult.perfStats?.start || null,
      tests: testResult.testResults.map(tr => ({
        title: tr.fullName,
        status: tr.status,
        duration: tr.duration,
        failureMessages: tr.failureMessages,
      })),
    };
    this._report.files.push(fileSummary);
  }

  onRunComplete(_, results) {
    this._report.endTime = new Date().toISOString();
    this._report.resultsSummary = {
      // Derive success from failures to avoid false negatives due to open handles
      success: (results.numFailedTests === 0 && results.numFailedTestSuites === 0),
      totalTests: results.numTotalTests,
      totalFailed: results.numFailedTests,
    };
    const outFile = path.join(this._outDir, `test-report-${this._runId}.json`);
    fs.writeFileSync(outFile, JSON.stringify(this._report, null, 2), 'utf8');
    console.log(`Test report written: ${outFile}`);
  }
};