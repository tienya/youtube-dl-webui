
const isProd = process.env.NODE_ENV === 'production';

export default {
  apiBaseURL: isProd ? '/' : 'http://127.0.0.1:8100'
}