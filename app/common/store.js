const config = require('../config');
const fs = require('fs');

const filename = config.saveFilePath;

module.exports = {
  async save(tasks) {
    fs.writeFileSync(filename, JSON.stringify(tasks || []));
  },

  async query() {
    if (!fs.existsSync(filename)) {
      return [];
    }
    const data = fs.readFileSync(filename);
    const tasks = JSON.parse(data) || [];
    return tasks;
  },

  async clean() {
    if (fs.existsSync(filename)) {
      fs.rmSync(filename);
    }
  }
}