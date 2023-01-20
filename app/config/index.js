
const { env } = process;
const path = require('path');

module.exports = {
  host: '127.0.0.1',
  port: '8100',
  isProd: env.NODE_ENV === 'production',
  saveFilePath: env.FILE_PATH || path.resolve(__dirname, '../../downloads/.ydwebui'),
  saveInterval: 60 * 1000, //ms
  auth: {
    name: env.AUTH_USER || '',
    pass: env.AUTH_PASS || '',
  }
}