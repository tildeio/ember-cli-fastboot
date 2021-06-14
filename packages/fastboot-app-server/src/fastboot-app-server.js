"use strict";

const assert           = require('assert');
const cluster          = require('cluster');
const os               = require('os');
const path             = require('path');
const serialize        = require('./utils/serialization').serialize;

class FastBootAppServer {
  constructor(options) {
    options = options || {};

    this.distPath = options.distPath;
    this.downloader = options.downloader;
    this.notifier = options.notifier;
    this.cache = options.cache;
    this.ui = options.ui;
    this.gzip = options.gzip;
    this.host = options.host;
    this.port = options.port;
    this.username = options.username;
    this.password = options.password;
    this.httpServer = options.httpServer;
    this.buildSandboxGlobals = options.buildSandboxGlobals;
    this.chunkedResponse = options.chunkedResponse;
    this.workerPath = options.workerPath;

    if (!this.ui) {
      let UI = require('./ui');
      this.ui = new UI();
    }

    this.propagateUI();

    this.workerCount = options.workerCount ||
      (process.env.NODE_ENV === 'test' ? 1 : null) ||
      os.cpus().length;

    this._clusterInitialized = false;

    assert(this.distPath || this.downloader, "FastBootAppServer must be provided with either a distPath or a downloader option.");
    assert(!(this.distPath && this.downloader), "FastBootAppServer must be provided with either a distPath or a downloader option, but not both.");
  }

  start() {
    return this.initializeApp()
      .then(() => this.subscribeToNotifier())
      .then(() => this.forkWorkers())
      .then(() => {
        if (this.initializationError) {
          this.broadcast({ event: 'error', error: this.initializationError.stack });
        }
      })
      .catch(err => {
        this.ui.writeLine(err.stack);
      })
      .finally(() => {
        this._clusterInitialized = true;
      });
  }

  stop() {
    this.broadcast({ event: 'shutdown' });
  }

  propagateUI() {
    if (this.downloader) { this.downloader.ui = this.ui; }
    if (this.notifier) { this.notifier.ui = this.ui; }
    if (this.cache) { this.cache.ui = this.ui; }
    if (this.httpServer) { this.httpServer.ui = this.ui; }
  }

  initializeApp() {
    // If there's a downloader, it returns a promise for downloading the app
    if (this.downloader) {
      return this.downloadApp()
        .catch(err => {
          this.ui.writeLine('Error downloading app');
          this.ui.writeLine(err.stack);
          this.initializationError = err;
        });
    }

    this.ui.writeLine(`using distPath; path=${this.distPath}`);

    return Promise.resolve();
  }

  downloadApp() {
    this.ui.writeLine('downloading app');

    return this.downloader.download()
      .then(distPath => {
        this.distPath = distPath;
      })
      .catch(err => {
        if (err.name.match(/AppNotFound/)) {
          this.ui.writeError('app not downloaded');
        } else {
          throw err;
        }
      });
  }

  subscribeToNotifier() {
    if (this.notifier) {
      this.ui.writeLine('subscribing to update notifications');

      return this.notifier.subscribe(() => {
        this.ui.writeLine('reloading server');
        this.initializeApp()
          .then(() => this.reload());
      })
      .catch(err => {
        this.ui.writeLine('Error subscribing');
        this.ui.writeLine(err.stack);
        this.initializationError = err;
      });
    }
  }

  /**
   * send message to worker
   *
   * @method broadcast
   * @param {Object} message
   */
  broadcast(message) {
    let workers = cluster.workers;

    for (let id in workers) {
      workers[id].send(message);
    }
  }

  reload() {
    this.broadcast({ event: 'reload', distPath: this.distPath });
  }

  forkWorkers() {
    let promises = [];

    // https://nodejs.org/api/cluster.html#cluster_cluster_setupprimary_settings
    // Note: cluster.setupPrimary in v16.0.0
    cluster.setupMaster(this.clusterSetupPrimary());

    for (let i = 0; i < this.workerCount; i++) {
      promises.push(this.forkWorker());
    }

    return Promise.all(promises);
  }

  forkWorker() {
    let worker = cluster.fork(this.buildWorkerEnv());

    this.ui.writeLine(`Worker ${worker.process.pid} forked`);

    let firstBootResolve;
    let firstBootReject;
    const firstBootPromise = new Promise((resolve, reject) => {
      firstBootResolve = resolve;
      firstBootReject = reject;
    });

    if (this._clusterInitialized) {
      firstBootResolve();
    }

    worker.on('online', () => {
      this.ui.writeLine(`Worker ${worker.process.pid} online.`);
    });

    worker.on('message', (message) => {
      if (message.event === 'http-online') {
        this.ui.writeLine(`Worker ${worker.process.pid} healthy.`);
        firstBootResolve();
      }
    });

    worker.on('exit', (code, signal) => {
      let error;
      if (signal) {
        error = new Error(`Worker ${worker.process.pid} killed by signal: ${signal}`);
      } else if (code !== 0) {
        error = new Error(`Worker ${worker.process.pid} exited with error code: ${code}`);
      } else {
        error = new Error(`Worker ${worker.process.pid} exited gracefully. It should only exit when told to do so.`);
      }

      if (!this._clusterInitialized) {
        // Do not respawn for a failed first launch.
        firstBootReject(error);
      } else {
        // Do respawn if you've ever successfully been initialized.
        this.ui.writeLine(error);
        this.forkWorker();
      }
    });

    return firstBootPromise;
  }

  buildWorkerEnv() {
    let env = {};

    if (this.distPath) {
      env.FASTBOOT_DIST_PATH = this.distPath;
    }

    return env;
  }

  /**
   * Extension point to allow configuring the default fork configuration.
   *
   * @method clusterSetupPrimary
   * @returns {Object}
   * @public
   */
  clusterSetupPrimary() {
    const workerOptions = {
      distPath: this.distPath || process.env.FASTBOOT_DIST_PATH,
      cache: this.cache,
      gzip: this.gzip,
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      httpServer: this.httpServer,
      buildSandboxGlobals: this.buildSandboxGlobals,
      chunkedResponse: this.chunkedResponse,
    };

    const workerPath = this.workerPath || path.join(__dirname, './worker-start.js');
    return {
      exec: workerPath,
      args: [serialize(workerOptions)]
    };
  }
}

module.exports = FastBootAppServer;
