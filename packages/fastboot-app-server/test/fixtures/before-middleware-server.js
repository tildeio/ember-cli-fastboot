'use strict';

var path = require('path');
const FastBootAppServer = require('../../src/fastboot-app-server');

var server = new FastBootAppServer({
  distPath: path.resolve(__dirname, './basic-app'),
  workerPath: path.resolve(__dirname, './cluster-worker-start'),
});

server.start();
