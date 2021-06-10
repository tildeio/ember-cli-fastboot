"use strict";

const expect = require("chai").expect;
const fs = require("fs");
const path = require("path");
const FastBoot = require("fastboot");
const buildDist = require("../helpers/build-dist");

function dummyRequest() {
  return {
    protocol: "http",
    url: "/foo",
    headers: {
      host: "localhost:4200",
      cookie: "",
    },
    method: "GET",
  };
}
function dummyResponse() {
  return { _headers: {} };
}

describe("FastBoot", function() {
  this.timeout(100000);
  it("can render HTML", async function() {
    const distPath = await buildDist("basic-app");
    const fastboot = new FastBoot({
      distPath,
    });

    // TODO: fastboot doesn't actually accept *only* distPath, it must receives request and response
    const html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());

    expect(html).to.match(/Basic fastboot ember app/);
  });

  it("can run multiple visits", async function() {
    const fastboot = new FastBoot({
      distPath: await buildDist("basic-app"),
    });

    let html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());
    expect(html).to.match(/Basic fastboot ember app/);

    html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());
    expect(html).to.match(/Basic fastboot ember app/);

    html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());
    expect(html).to.match(/Basic fastboot ember app/);
  });

  it("cannot not render app HTML with shouldRender set as false", async function() {
    const fastboot = new FastBoot({
      distPath: await buildDist("basic-app"),
    });

    return fastboot
      .visit("/", {
        shouldRender: false,
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html())
      .then((html) => {
        expect(html).to.not.match(/Basic fastboot ember app/);
      });
  });

  it("can serialize the head and body", async function() {
    const fastboot = new FastBoot({
      distPath: await buildDist("basic-app"),
    });

    return fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => {
        let contents = r.domContents();

        expect(contents.head.trim()).to.equal(
          `<meta name="ember-cli-head-start" content><meta property="og:title">\n<meta name="ember-cli-head-end" content>`
        );
        expect(contents.body).to.match(/Basic fastboot ember app/);
      });
  });

  it("can forcefully destroy the app instance using destroyAppInstanceInMs", async function() {
    const fastboot = new FastBoot({
      distPath: await buildDist("basic-app"),
    });

    return fastboot
      .visit("/", {
        destroyAppInstanceInMs: 5,
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .catch((e) => {
        expect(e.message).to.equal(
          "App instance was forcefully destroyed in 5ms"
        );
      });
  });

  it("can reload the distPath", async function() {
    const distPath = await buildDist("basic-app");
    const hotSwapAppPath = await buildDist("hot-swap-app");
    let fastboot = new FastBoot({
      distPath,
    });

    let html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());
    expect(html).to.match(/Basic fastboot ember app/);

    fastboot.reload({
      distPath: hotSwapAppPath,
    });
    html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());
    expect(html).to.match(/Hot swap ember app/);
  });

  it("can reload the app using the same buildSandboxGlobals", async function() {
    const basicApp = await buildDist("basic-app");
    const customSandbox = await buildDist("custom-sandbox-app");
    const fastboot = new FastBoot({
      distPath: basicApp,
      buildSandboxGlobals(globals) {
        return Object.assign({}, globals, {
          foo: 5,
          myVar: "undefined",
        });
      },
    });

    let html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());

    expect(html).to.match(/Basic fastboot ember app/);

    fastboot.reload({
      distPath: customSandbox,
    });

    html = await fastboot
      .visit("/", {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then((r) => r.html());
    expect(html).to.match(/foo from sandbox: 5/);
  });
  
  it('removes fastboot config and scripts from response html', async function() {
    const basicApp = await buildDist('basic-app');
    const fastboot = new FastBoot({
      distPath: basicApp,
    });
    const distHtml = fs.readFileSync(`${basicApp}/index.html`, 'utf-8');
    expect(distHtml).to.match(/fastboot-script/);
    expect(distHtml).to.match(/basic-app\/config\/fastboot-environment/);
    expect(distHtml).to.match(/example-addon\/config\/fastboot-environment/);

    const html = await fastboot
      .visit('/', {
        request: dummyRequest(),
        response: dummyResponse(),
      })
      .then(r => r.html());
    expect(html).to.not.match(/fastboot-script/);
    expect(html).to.not.match(/config\/fastboot-environment/);
  });
});
