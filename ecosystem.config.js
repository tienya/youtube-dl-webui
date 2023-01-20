
const pkg = require('./package.json');

module.exports = {
  apps: [{
    name: pkg.name,
    script: './app.js',
    instances: 1,
  }],
};
