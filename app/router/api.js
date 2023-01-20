const Router = require('koa-router');
const youtubedl = require('youtube-dl-exec');
const ServiceError = require('../common/ServiceError');
const { md5 } = require('../common/utils');
const fs = require('fs');
const path = require('path');
const disk = require('diskusage');
const config = require('../config');
const store = require('../common/store');

const router = new Router({
  prefix: '/api',
});

let tasks = [];
const pidMap = {};

setInterval(() => {
  store.save(tasks);
}, config.saveInterval);

async function getFreeSpace(path) {
  try {
    const { free } = await disk.check(path);
    return free
  } catch (err) {
    console.error(err)
    return 0
  }
}

async function listFiles() {
  const dldir = 'downloads';
  const dirs = fs.readdirSync(dldir).filter(dir => !dir.startsWith('.'));
  const dirStat = {};
  for (const dir of dirs) {
    if (!fs.lstatSync(path.resolve(dldir, dir)).isDirectory()) {
      continue;
    }
    let files = dirStat[dir];
    if (!files) {
      files = dirStat[dir] = [];
    }
    const filenames = fs.readdirSync(path.resolve(dldir, dir)).filter(dir => !dir.startsWith('.'));
    for (const filename of filenames) {
      const stat = fs.statSync(path.resolve(dldir, dir, filename));
      const pathname = `/downloads/${dir}/${filename}`;
      const url = `http://${config.host}:${config.port}${pathname}`;
      files.push({
        id: md5(pathname),
        dir,
        url,
        filename: filename,
        filesize: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
        atime: stat.atime,
        isFile: !stat.isDirectory(),
      });
    }
    files.sort((a, b) => b.ctime - a.ctime)
  }
  return dirStat;
}

function deleteTask(id) {
  const idx = tasks.findIndex(task => task.id === id);
  let task = null;
  if (idx > -1) {
    task = tasks[idx];
    tasks.splice(idx, 1);
  }
  const proc = pidMap[id];
  if (proc) {
    proc.cancel();
    delete pidMap[id];
  }
  return task;
}

router.get('/task/list', async (ctx) => {
  if (!tasks.length) {
    tasks = await store.query();
    // restart
    tasks.forEach((task) => {
      if (task.status === 'pending') {
        task.status = 'error';
      }
    });
  }
  const freeSize = await getFreeSpace('.');
  const dirStat = await listFiles();
  tasks.forEach(task => {
    const files = dirStat[task.category] || [];
    if (task.category === 'videos') {
      task.files = files.filter(file => file.filename === task.title);
    } else {
      task.files = files;
    }
  });
  return ctx.body = {
    tasks,
    freeSize,
    success: true
  }
});

router.post('/task/delete', async (ctx) => {
  const { id, deleteFiles } = ctx.request.body;
  if (!id) {
    throw new ServiceError('task id required');
  }
  const task = deleteTask(id);
  if (deleteFiles && task) {
    task.files.forEach(file => {
      fs.rmSync(path.join('./downloads', task.category, file.filename));
    })
  }
  return ctx.body = {
    id,
    success: true
  }
});

router.post('/file/delete', async (ctx) => {
  const { fileId, taskId } = ctx.request.body;
  if (!fileId) {
    throw new ServiceError('file id required')
  }
  if (!taskId) {
    throw new ServiceError('task id required')
  }
  const task = tasks.find(task => task.id === taskId);
  if (task) {
    const idx = task.files.findIndex(file => file.id === fileId);
    if (idx > -1) {
      const file = task.files[idx];
      task.files.splice(idx, 1);
      fs.rmSync(path.resolve('downloads', file.dir, file.filename));
    }
  }
  return ctx.body = {
    fileId,
    success: true
  }
});

router.post('/task/stop', async (ctx) => {
  const { id } = ctx.request.body;
  const task = tasks.find(task => task.id === id);
  const proc = pidMap[id];
  if (proc) {
    proc.cancel();
    delete pidMap[id];
  }
  if (task) {
    task.status == 'error';
  }
  return ctx.body = {
    id,
    success: true
  }
});

router.post('/task/create', async (ctx) => {
  let { url, restart, options } = ctx.request.body || {};
  const id = restart || md5(url);
  if (!url && !restart) {
    throw new ServiceError('url required');
  }
  // already
  if (!restart && tasks.find(task => task.id === id)) {
    return ctx.body = {
      success: true
    }
  }
  const old = deleteTask(id);
  if (old) {
    url = old.url;
  }
  // new one
  const proc = youtubedl.exec(url, {
    // skipDownload: true, // debug
    playlistReverse: true,
    paths: 'downloads',
    output: '%(playlist|videos)s/%(playlist_autonumber|)s%(playlist_autonumber& - |)s%(title)s.%(ext)s',
    noPart: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    addHeader: [
      'referer:youtube.com',
      'user-agent:googlebot'
    ],
    ...options
  });
  let task = {
    id,
    url,
    title: old ? old.title : url,
    logs: [
      `Running task in ${proc.pid}`,
      url
    ],
    files: [],
    percent: '',
    size: '',
    speed: '',
    eta: '',
    status: 'init',
    current: 0,
    total: 0,
    category: '',
    create_time: new Date(),
    pid: proc.pid,
  };
  tasks.push(task);
  pidMap[task.id] = proc;
  proc.stdout.on('data', (chunk) => {
    if (task.status !== 'error') {
      task.status = 'pending';
    }
    const lines = chunk.toString().split(/(\n|\r)/).filter(v => v.trim());
    for (let line of lines) {
      // console.log(line)
      // parse info
      const fileInfos = line.match(/^\[download\] (Destination: )?\w+\/([^/]+)\/(.+\.\w+)( has already been downloaded)?$/);
      if (fileInfos) {
        task.category = fileInfos[2];
        task.title = task.category && task.category !== 'videos' ? task.category : fileInfos[3];
        continue;
      }
      const progressInfos = line.match(/\[download\]\s+(\S+)\s+of\s+(\S+)(\s+at\s+(\S+)\s+ETA\s+(\S+))?/);
      if (progressInfos) {
        const [nline, percent, size = '', eline, speed = '', eta = ''] = progressInfos;
        Object.assign(task, { percent, size, speed, eta });
        continue;
      }
      const downloadVideos = line.match(/\[download\] Downloading video (\d+) of (\d+)/)
      if (downloadVideos) {
        const [nline, current, total] = downloadVideos;
        Object.assign(task, { current, total });
      }
      task.logs.push(line);
    }
  });
  proc.stderr.on('data', (chunk) => {
    const logs = chunk.toString().split(/(\n|\r)/).filter(v => v.trim());
    if (logs.length) {
      task.logs.push(...logs);
    }
  });

  proc.then((date) => {
    task.status = 'done';
  }).catch((err) => {
    if (!err.isCanceled) {
      console.error(err);
    }
    task.logs.push(err.isCanceled ? 'task was canceled' : err.message);
    task.status = 'error';
  })

  // setTimeout(proc.cancel, 3000);
  // await new Promise((resolve) => setTimeout(resolve, 1000));

  return ctx.body = {
    task,
    success: true,
  };
});

module.exports = router;
