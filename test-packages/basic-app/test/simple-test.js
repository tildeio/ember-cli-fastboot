'use strict';

const RSVP = require('rsvp');
const request = RSVP.denodeify(require('request'));
const expect = require('chai').use(require('chai-string')).expect;
const { startServer, stopServer } = require('../../test-libs');

describe('simple acceptance', function() {
  this.timeout(120000);

  before(function() {
    return startServer();
  });

  after(function() {
    return stopServer();
  });

  it('/ HTML contents', async () => {
    const response = await request({
      url: `http://localhost:45678/`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("text/html; charset=utf-8");
    expect(response.body).to.contain("Basic fastboot ember app");
  });

  it('with fastboot query parameter turned on', async () => {
    const response = await request({
      url: `http://localhost:45678/?fastboot=true`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("text/html; charset=utf-8");
    expect(response.body).to.contain("Basic fastboot ember app");
  });

  it('with fastboot query parameter turned off', async () =>  {
    const response = await request({
      url: `http://localhost:45678/?fastboot=false`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("text/html; charset=utf-8");
    expect(response.body).to.contain("<!-- EMBER_CLI_FASTBOOT_BODY -->");
  });

  it('/posts HTML contents', async () =>  {
    const response = await request({
      url: `http://localhost:45678/posts`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("text/html; charset=utf-8");
    expect(response.body).to.contain("Basic fastboot ember app");
    expect(response.body).to.contain("Posts Route!");
  });

  it('/not-found HTML contents', async () =>  {
    const response = await request({
      url: `http://localhost:45678/not-found`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("text/html; charset=utf-8");
    expect(response.body).to.contain("<!-- EMBER_CLI_FASTBOOT_BODY -->");
  });

  it('/boom HTML contents', async () =>  {
    const response = await request({
      url: `http://localhost:45678/boom`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.statusCode).to.equal(500);
    expect(response.headers["content-type"]).to.equalIgnoreCase("text/html; charset=utf-8");
    expect(response.body).to.contain("BOOM");
  });

  it('/imports HTML contents', async () =>  {
    const response = await request({
      url: `http://localhost:45678/imports`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("text/html; charset=utf-8");
    expect(response.body).to.contain("FastBoot compatible vendor file: FastBoot default default value");
  });

  it('the body is contained between markers', async () => {
    const response = await request({
      url: `http://localhost:45678`,
      headers: {
        'Accept': 'text/html'
      }
    })

    expect(response.body).to.contain('<script type="x/boundary" id="fastboot-body-start"></script>')
    expect(response.body).to.contain('<script type="x/boundary" id="fastboot-body-end"></script>')
  });

  it('/assets/vendor.js', async () =>  {
    const response = await request(`http://localhost:45678/assets/vendor.js`)

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("application/javascript; charset=utf-8");
    expect(response.body).to.contain("Ember =");
  });

  it('/assets/basic-app.js', async () =>  {
    const response = await request(`http://localhost:45678/assets/basic-app.js`)

    expect(response.statusCode).to.equal(200);
    expect(response.headers["content-type"]).to.equalIgnoreCase("application/javascript; charset=utf-8");
    expect(response.body).to.not.contain("autoBoot: false");
  });
});
