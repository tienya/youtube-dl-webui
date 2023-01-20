require('dotenv').config();

const config = require('./app/config');
const path = require('path');
const Koa = require('koa');
const koaCors = require('@koa/cors');
const { koaBody } = require('koa-body');
const koaStatic = require('koa-static');
const koaMount = require('koa-mount');
const range = require('koa-range');
const apiHandler = require('./app/middleware/apiHandler')
const trimReqBody = require('./app/middleware/trimReqBody')

const app = new Koa();

if (!config.isProd) {
  app.use(koaCors({
    origin: '*'
  }));
}

app.on('error', err => {
  if (err.code === 'EPIPE') {
    console.log('range error', err.message);
  } else {
    console.error('uncatch error', err);
  }
});

app.use(koaBody({
  onError(err) {
    // parse body error
    throw new ServiceError({
      code: 'parse.error',
      message: err.message,
    });
  },
}));
app.use(trimReqBody())
app.use(apiHandler({ prefix: '/api/' }))

// router
app.use(require('./app/router').routes());
app.use(require('./app/router/api').routes());

// client
const staticOpts = {
  maxAge: 90 * 24 * 3600 * 1000,
  gzip: true,
  setHeaders: (res, reqPath, stats) => {
    if (/\.html$/i.test(path.basename(reqPath))) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
};
app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    console.log(err);
  }
})
app.use(range);
app.use(koaMount('/downloads', koaStatic('./downloads', staticOpts)));
app.use(koaMount('/', koaStatic('./client/dist', staticOpts)));

app.host = config.host;
app.port = config.port;

// 启动服务
const server = app.listen(app.port, app.host, () => {
  console.log('Started http://%s:%d', server.address().address, server.address().port);
});