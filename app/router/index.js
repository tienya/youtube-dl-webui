const Router = require('koa-router');
const pkg = require('../../package.json');

const router = new Router({
  prefix: '',
});

router.get('/ver', async ctx => ctx.body = {
  ver: pkg.version,
});

router.get('/ts', async ctx => ctx.body = {
  ts: new Date(),
});

module.exports = router;
