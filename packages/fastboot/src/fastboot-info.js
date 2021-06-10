'use strict';

const FastBootRequest = require('./fastboot-request');
const FastBootResponse = require('./fastboot-response');

/*
 * A class that encapsulates information about the
 * current HTTP request from FastBoot. This is injected
 * on to the FastBoot service.
 *
 * @param {ClientRequest} the incoming request object
 * @param {ClientResponse} the response object
 * @param {Object} additional options passed to fastboot info
 * @param {Array} [options.hostWhitelist] expected hosts in your application
 * @param {Object} [options.metaData] per request meta data
 */
module.exports = class FastBootInfo {
  constructor(request, response, options) {
    this.deferredPromise = Promise.resolve();
    let { hostWhitelist, metadata } = options;

    if (request) {
      this.request = new FastBootRequest(request, hostWhitelist);
    }

    this.response = new FastBootResponse(response || {});
    this.metadata = metadata;
  }

  deferRendering(promise) {
    this.deferredPromise = Promise.all([this.deferredPromise, promise]);
  }
};
