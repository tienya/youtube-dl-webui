import axios from 'axios';
import config from '../config';

const request = axios.create({
  baseURL: config.apiBaseURL,
  timeout: 2 * 60 * 1000, // request timeout
});

request.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (!data.success) {
      return Promise.reject(data);
    }
    return data;
  },
  (error) => {
    let err = {};
    const { data } = error.response || {};
    // cancel request
    // eslint-disable-next-line no-underscore-dangle
    if (error.__CANCEL__) {
      err = {
        code: 'cancel',
      };
    } else {
      if (typeof data === 'object') {
        err = data;
      } else {
        err = {
          code: error.code,
          message: error.message,
          data,
        };
      }
    }
    return Promise.reject(err);
  },
);

export default request;