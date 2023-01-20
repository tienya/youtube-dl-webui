<script>
import request from './common/request';
import moment from 'moment';

export default  {
  data() {
    return {
      freeSize: 0,
      showLog: false,
      loading: false,
      url: '',
      listing: false,
      tasks: [],
      task: {},
      playing: false,
      file: {},
    }
  },
  created() {
    this.init();
    this.startAutoRefreshTasks();
  },
  unmounted() {
    this.clearAutoRefreshTasks();
  },
  methods: {
    sizefmt(v) {
      let fmt = v ? v + 'B' : '--';
      if (v > 1024 * 1024 * 1024) {
        fmt = Math.round(v * 10 / (1024 * 1024 * 1024 )) / 10 + 'GB';
      }
      else if (v > 1024 * 1024) {
        fmt = Math.round(v * 10 / (1024 * 1024)) / 10 + 'MB';
      }
      else if (v > 1024) {
        fmt = Math.round(v * 10 / (1024)) / 10 + 'KB';
      }
      return fmt;
    },
    datefmt(v) {
      return v ? moment(v).fromNow() : '--';
    },
    async init() {
      this.queryTasks();
    },
    clearAutoRefreshTasks() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    },
    startAutoRefreshTasks() {
      this.clearAutoRefreshTasks();
      this.timerId = setInterval(async () => {
        // wait for next
        if (this.listing) {
          return;
        }
        this.queryTasks();
      }, 5000);
    },
    async queryTasks() {
      try {
        this.listing = true;
        const data = await request({
          url: '/api/task/list',
          method: 'get',
          params: {
          }
        })
        this.tasks = data.tasks;
        this.freeSize = data.freeSize;
      } catch (err) {
        console.error(err);
        // this.$message({ type: 'error', message: err.message });
      } finally {
        this.listing = false;
      }
    },
    async createTask(task) {
      try {
        this.loading = true;
        const data = await request({
          url: '/api/task/create',
          method: 'post',
          data: {
            url: this.url,
            restart: task ? task.id : undefined,
          }
        })
        await this.queryTasks();
      } catch (err) {
        console.error(err);
        this.$message({ type: 'error', message: err.message });
      } finally {
        this.loading = false;
      }
    },
    async deleteTask(task) {
      try {
        task.deleting = true;
        const action = await new Promise((resolve) => {
          ElMessageBox.confirm(
            'Delete ' + task.title,
            'Warning',
            {
              distinguishCancelAndClose: true,
              confirmButtonText: 'Delete Task',
              cancelButtonText: 'Delete Task and Files',
              type: 'warning',
            }
          ).then(() => {
            resolve('task');
          }).catch(action => {
            resolve(action === 'cancel' ? 'delete' : '');
          })
        });
        if (action) {
          task.status = 'error';
          const data = await request({
            url: '/api/task/delete',
            method: 'post',
            data: {
              id: task.id,
              deleteFiles: action === 'delete'
            }
          })
          await this.queryTasks();
        }
      } catch (err) {
        console.error(err);
        this.$message({ type: 'error', message: err.message });
      } finally {
        task.deleting = false;
      }
    },
    async stopTask(task) {
      try {
        task.stoping = true;
        task.status = 'error';
        const data = await request({
          url: '/api/task/stop',
          method: 'post',
          data: {
            id: task.id
          }
        })
        // await this.queryTasks();
      } catch (err) {
        console.error(err);
        this.$message({ type: 'error', message: err.message });
      } finally {
        task.stoping = false;
      }
    },
    async delteTaskFile(file, taskId) {
      try {
        file.deleting = true;
        const data = await request({
          url: '/api/file/delete',
          method: 'post',
          data: {
            fileId: file.id,
            taskId: taskId
          }
        });
        const tasks = this.tasks;
        const task = tasks.find(task => task.id === taskId);
        if (task) {
          const idx = task.files.findIndex(file => file.id === file.id);
          if (idx > -1) {
            task.files.splice(idx, 1);
          }
        }
      } catch (err) {
        console.error(err);
        this.$message({ type: 'error', message: err.message });
      } finally {
        file.deleting = false;
      }
    },
    onDialogClose() {
      const player = this.$refs.player;
      if (player && !player.paused) {
        player.pause();
      }
    },
    playVideo(file) {
      this.file = file;
      this.playing = true;
      const player = this.$refs.player;
      if (player && player.paused) {
        player.play();
      }
    }
  }
}
</script>

<template>
  <div class="layout">
    <el-container>
      <el-header>
        <h1>Youtube Downloader WebUI</h1>
      </el-header>
      <el-main>
        <h2>
          Create download task
        </h2>
        <div class="create">
          <el-input v-model="url" placeholder="Please input youtube video page url" @keyup.enter="createTask">
            <template #prepend>youtube-dl</template>
          </el-input>
          <el-button type="primary" class="submit" :disabled="loading" @click="createTask">Submit</el-button>
        </div>
        <h2>
          Download tasks
          <el-button round :disabled="listing" @click="queryTasks">
            Refresh
          </el-button>
          <span style="float: right; font-size: 14px; line-height: 32px;">Disk: {{sizefmt(freeSize)}}</span>
        </h2>
        <div class="tasks">
          <el-table
            :data="tasks"
            style="width: 100%; margin-bottom: 20px"
            row-key="id"
            border
            highlight-current-row
          >
            <el-table-column type="expand">
              <template #default="{ row }">
                <div style="padding: 0 10px 0 20px;">
                  <el-table :data="row.files" :show-header="false" row-key="id"
                    border highlight-current-row size="small">
                    <el-table-column label="Name" prop="filename">
                      <template #default="{ row }">
                        <a :href="row.url" @click.prevent="playVideo(row)" class="filename">{{row.filename}}</a>
                      </template>
                    </el-table-column>
                    <el-table-column label="Size" prop="filesize" width="80">
                      <template #default="{ row }">
                        {{ sizefmt(row.filesize) }}
                      </template>
                    </el-table-column>
                    <el-table-column label="Time" prop="atime" width="110">
                      <template #default="{ row }">
                        {{ datefmt(row.atime) }}
                      </template>
                    </el-table-column>
                    <el-table-column label="Actions" prop="ctime" width="210">
                      <template #default="scope">
                        <el-button-group size="small">
                          <el-button plain type="primary" @click="playVideo(scope.row)">Play</el-button>
                          <el-popconfirm title="Are you sure to delete this?" @confirm="delteTaskFile(scope.row, row.id)">
                            <template #reference>
                              <el-button plain type="danger" :disabled="scope.row.deleting">Delete</el-button>
                            </template>
                          </el-popconfirm>
                          <el-button plain><a :href="scope.row.url" download>Download</a></el-button>
                        </el-button-group>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="Title" />
            <el-table-column prop="status" label="Status" width="80" />
            <el-table-column prop="percent" label="Progress" width="90"/>
            <el-table-column prop="size" label="Size" width="100">
              <template #default="{ row }">
                <div>{{ row.size }}</div>
                <div v-if="row.total">{{ row.current }} of {{row.total}}</div>
              </template>
            </el-table-column>
            <el-table-column prop="speed" label="Speed" width="110">
              <template #default="{ row }">
                <div>{{ row.speed }}</div>
                <div>{{ row.eta }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="log" label="Actions" width="200">
              <template #default="{ row }">
                <el-button-group size="small">
                  <el-button v-if="['done', 'error'].includes(row.status)" type="primary" @click="createTask(row)">Start</el-button>
                  <el-button v-else type="info" @click="stopTask(row)">Stop</el-button>
                  <el-button type="danger" @click="deleteTask(row)">Delete</el-button>
                  <el-button @click="this.task = row; this.showLog = true;">Logs</el-button>
                </el-button-group>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-main>
    </el-container>
    <el-drawer
      v-model="showLog"
      :title="task.title || ''"
      direction="rtl"
      size="40%"
    >
      <div style="margin: 5px 0;" v-for="log in task.logs">{{log}}</div>
    </el-drawer>
    <el-dialog v-model="playing" :title="file.filename" width="60%" draggable @close="onDialogClose">
      <video ref="player" :src="file.url" playsinline webkit-playsinline style="width: 100%; height: auto; min-height: 100px;" controls autoplay></video>
    </el-dialog>
  </div>
</template>

<style scoped>
.create {
  display: flex;
}
.submit {
  margin-left: 20px;
}
.filename {
  text-decoration: none;
  color: #000;
}
</style>
