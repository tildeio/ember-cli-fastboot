'use strict';

const RSVP = require('rsvp');
const request = RSVP.denodeify(require('request'));
const expect = require('chai').use(require('chai-string')).expect;
const { startServer, stopServer } = require('../../test-libs');

describe('response details', function() {
  this.timeout(120000);

  before(function() {
    return startServer();
  });

  after(function() {
    return stopServer();
  });

  it('makes headers available via a service', async () => {
    const response = await request({
      url: `http://localhost:45678/echo-request-headers`,
      headers: {
        'X-FastBoot-echo': 'i-should-be-echoed-back',
        'Accept': 'text/html'
      }
    });

    expect(response.headers).to.include.keys('x-fastboot-echoed-back');
    expect(response.headers['x-fastboot-echoed-back']).to.include('i-should-be-echoed-back');
  });

  it('makes the status code available via a service', async () => {
    const response = await request({
      url: `http://localhost:45678/return-status-code-418`,
      headers: {
        'Accept': 'text/html'
      }
    });

    expect(response.statusCode).to.equal(418);
  });
});
