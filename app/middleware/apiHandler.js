// API handler
const crypto = require('crypto');
const ServiceError = require('../common/ServiceError');

module.exports = function apiHandler(options = {}) {
  const { prefix = '' } = options;
  return async (ctx, next) => {
    // only prefix
    if (prefix && ctx.path.indexOf(prefix) !== 0) {
      return next();
    }
    try {
      if (!ctx.reqId){
        ctx.reqId = crypto.randomUUID();
      }
      await next();
      if (ctx.body) {
        if (!ctx.body.reqId) {
          ctx.body.reqId = ctx.reqId;
        }
        ctx.body.success = true;
      }
    } catch (err) {
      if (ServiceError.isFatalError(err)) {
        console.error(err.stack);
        console.error({ ...err, stack: undefined });
      }
      ctx.status = err.status || 400;
      ctx.body = {
        reqId: ctx.reqId,
        success: false,
        code: err.code,
        message: ServiceError.getSafeMsg(err),
      };
    }
  };
};
