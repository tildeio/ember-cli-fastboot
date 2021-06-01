'use strict';

const ClusterWorker = require('./worker');
const worker = new ClusterWorker();

worker.start();
