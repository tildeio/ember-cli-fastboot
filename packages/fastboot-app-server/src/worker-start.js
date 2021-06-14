'use strict';

// This file is where you can configure
// - distPath, host, port,
// - httpServer
// - Middleware order
const ClusterWorker = require('./worker');
const worker = new ClusterWorker();

worker.start();
