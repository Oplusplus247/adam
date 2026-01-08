const fs = require('fs');
const path = require('path');
const util = require('util');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
let fileLoggingFailed = false;

function getLevel() {
  const env = (process.env.TEST_LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[env] || LEVELS.info;
}

function time() { 
  return new Date().toISOString(); 
}

function createLogger(component = 'logger') {
  const minLevel = getLevel();

  function shouldLog(level) {
    return LEVELS[level] >= minLevel;
  }

  function fmtObj(obj) {
    if (!obj) return '';
    try {
      return ` ${JSON.stringify(obj)}`;
    } catch (_) {
      try {
        return ` ${util.inspect(obj, { depth: 2, colors: false })}`;
      } catch (e) {
        return ` ${String(obj)}`;
      }
    }
  }

  function maybeWriteErrorToFile(msg, err) {
    try {
      if (process.env.TEST_LOG_TO_FILE !== '1' || fileLoggingFailed) return;
      
      const dir = process.env.TEST_LOG_DIR || path.join(process.cwd(), 'test-logs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const file = path.join(dir, `${component}.error.log`);
      const line = `${time()} ${component} - ${msg} - ${err.message}\n${err.stack}\n\n`;
      fs.appendFileSync(file, line);
    } catch (e) {
      if (!fileLoggingFailed) {
        console.warn(`[WARN] File logging disabled for ${component}: ${e.message}`);
        fileLoggingFailed = true;
      }
    }
  }

  return {
    debug: (msg, obj) => { 
      if (shouldLog('debug')) console.debug(`[DEBUG] ${time()} ${component} - ${msg}` + fmtObj(obj)); 
    },
    info: (msg, obj) => { 
      if (shouldLog('info')) console.info(`[INFO]  ${time()} ${component} - ${msg}` + fmtObj(obj)); 
    },
    warn: (msg, obj) => { 
      if (shouldLog('warn')) console.warn(`[WARN]  ${time()} ${component} - ${msg}` + fmtObj(obj)); 
    },
    error: (msg, obj) => {
      if (!shouldLog('error')) return;
      
      if (obj instanceof Error) {
        console.error(`[ERROR] ${time()} ${component} - ${msg} ${obj.message}\n${obj.stack}`);
        maybeWriteErrorToFile(msg, obj);
      } else {
        console.error(`[ERROR] ${time()} ${component} - ${msg}` + fmtObj(obj));
        if (obj && obj.error instanceof Error) {
          console.error(obj.error.stack);
          maybeWriteErrorToFile(msg, obj.error);
        }
      }
    },
  };
}

module.exports = createLogger;