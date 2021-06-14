'use strict';

const cookie = require('cookie');
const FastBootHeaders = require('./fastboot-headers');

class FastBootRequest {
  constructor(request, hostAllowList) {
    this.hostAllowList = hostAllowList;

    this.protocol = `${request.protocol}:`;
    this.headers = new FastBootHeaders(request.headers);
    this.queryParams = request.query;
    this.path = request.url;
    this.method = request.method;
    this.body = request.body;

    this.cookies = this.extractCookies(request);
  }

  host() {
    if (!this.hostAllowList) {
      throw new Error('You must provide a hostAllowList to retrieve the host');
    }

    var host = this.headers.get('host');
    var matchFound = this.hostAllowList.some(function(entry) {
      if (entry[0] === '/' && entry.slice(-1) === '/') {
        var regexp = new RegExp(entry.slice(1, -1));
        return regexp.test(host);
      } else {
        return entry === host;
      }
    });

    if (!matchFound) {
      throw new Error(`The host header did not match a hostAllowList entry. Host header: ${host}`);
    }

    return host;
  }

  extractCookies(request) {
    // If cookie-parser middleware has already parsed the cookies,
    // just use that.
    if (request.cookies) {
      return request.cookies;
    }

    // Otherwise, try to parse the cookies ourselves, if they exist.
    var cookies = request.headers.cookie;
    if (cookies) {
      return cookie.parse(cookies);
    }

    // Return an empty object instead of undefined if no cookies are present.
    return {};
  }
}

module.exports = FastBootRequest;
