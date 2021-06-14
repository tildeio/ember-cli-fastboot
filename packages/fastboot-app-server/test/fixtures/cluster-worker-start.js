'use strict';

const ClusterWorker = require('../../src/worker');

class CustomClusterWorker extends ClusterWorker {}

function setStatusCode418(req, res, next) {
  res.status(418);
  next();
}

function setXTestHeader(req, res, next) {
  res.set('X-Test-Header', 'testing')
  next();
}

function sendJsonAndTerminate(req, res, next) {
  res.json({ send: 'json back' });
  res.send();
}

function beforeMiddleware(app) {
  app.use(setStatusCode418);
  app.use(setXTestHeader);
  app.use(sendJsonAndTerminate);
}

function afterMiddleware(app) {
  app.use(setXTestHeader);
}

const worker = new CustomClusterWorker({
  beforeMiddleware,
  afterMiddleware,
});

worker.start();
