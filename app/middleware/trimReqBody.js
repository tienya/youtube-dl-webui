
// auto trim params value
module.exports = function trimReqBody(options) {
  return async (ctx, next) => {
    const params = ctx.request.body;
    const query = ctx.query;
    if (typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'string') {
          params[key] = value.trim();
        }
      });
    }
    if (typeof query === 'object') {
      Object.entries(query).forEach(([key, value]) => {
        if (typeof value === 'string') {
          query[key] = value.trim();
        }
      });
    }
    return next();
  };
};
