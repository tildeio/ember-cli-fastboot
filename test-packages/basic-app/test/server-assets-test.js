'use strict';

const RSVP = require('rsvp');
const request = RSVP.denodeify(require('request'));
const expect = require('chai').use(require('chai-string')).expect;
const { startServer, stopServer } = require('../../test-libs');

describe('serve assets acceptance', function() {
  this.timeout(120000);

  before(function() {
    return startServer();
  });

  after(function() {
    return stopServer();
  });

  it('/assets/vendor.js', async () => {
    const response = await request(`http://localhost:45678/assets/vendor.js`)

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("application/javascript; charset=utf-8");
    expect(response.body).to.contain("Ember =");
  });

  it('/assets/basic-app.js', async () => {
    const response = await request(`http://localhost:45678/assets/basic-app.js`)

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("application/javascript; charset=utf-8");
    expect(response.body).to.contain("this.route('posts')");
  });
});
