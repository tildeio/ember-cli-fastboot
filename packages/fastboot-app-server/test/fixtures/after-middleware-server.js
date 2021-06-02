'use strict';

var path = require('path');
const FastBootAppServer = require('../../src/fastboot-app-server');

var server = new FastBootAppServer({
  distPath: path.resolve(__dirname, './broken-app'),
  workerPath: path.resolve(__dirname, './cluster-worker-start'),
  resilient: true,
});

server.start();
