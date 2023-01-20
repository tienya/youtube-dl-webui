class ServiceError extends Error {
  /**
   * CustomError
   * @param {object} params
   * @param {Error} cause 
   */
  constructor(params = {}, cause) {
    let { message = '' } = params;
    const { code = '', data, fatal = false, status } = params;
    if (typeof params === 'string') {
      message = params;
    }
    message = message || 'unkown error';
    super(message);
    this.message = message;
    this.name = 'ServiceError';
    this.fatal = fatal;
    this.code = code;
    this.data = data;
    this.status = status;

    Error.captureStackTrace(this, this.constructor);

    if (cause && cause.stack) {
      this.stack += `\n--------------------\nCaused by: \n${cause.stack}`;
    }
  }

  // 是否致命错误，这种错误需要记录
  static isFatalError(err) {
    let flag = false;
    if (err) {
      if (!(err instanceof ServiceError)) {
        flag = true;
      } else {
        flag = err.fatal;
      }
    }
    return flag;
  }

  static getSafeMsg(err) {
    if (ServiceError.isFatalError(err)) {
      return 'unkown error';
    }
    return err.message;
  }
}

module.exports = ServiceError;
