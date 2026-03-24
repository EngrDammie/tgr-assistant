const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
});

// Create a pino-compatible logger wrapper with .child() support
const logger = Object.create(baseLogger, {
  child: {
    value: function(options) {
      return baseLogger.child(options);
    }
  }
});

module.exports = logger;
