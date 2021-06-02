'use strict';

// This file is where you can configure
// - distPath, host, port,
// - httpServer
const ClusterWorker = require('./worker');
const worker = new ClusterWorker();

worker.start();
