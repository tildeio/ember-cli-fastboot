"use strict";

const chai = require("chai");
const expect = chai.expect;
const fs = require("fs-extra");
const execa = require("execa");

chai.use(require("chai-fs"));

describe("generating package.json", function () {
  this.timeout(300000);

  describe("with FastBoot builds", function () {
    before(async function () {
      await execa("yarn", ["build"]);
    });

    it("builds a package.json", async function () {
      expect("dist/assets/basic-app.js").to.be.a.file();
      expect("dist/package.json").to.be.a.file();
    });

    it("merges FastBoot dependencies from multiple addons", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.dependencies).to.deep.equal({
        "abortcontroller-polyfill": "^1.4.0",
        foo: "1.0.0",
        bar: "^0.1.2",
        baz: "0.0.0",
        "node-fetch": "^2.6.0",
        rsvp: "^4.8.5",
      });
    });

    it("contains a schema version", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.schemaVersion).to.deep.equal(3);
    });

    it("contains a list of allowed module names", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.moduleAllowlist).to.deep.equal([
        "node-fetch",
        "abortcontroller-polyfill",
        "abortcontroller-polyfill/dist/cjs-ponyfill",
        "path",
        "foo",
        "bar",
        "baz",
        "rsvp",
      ]);
    });

    it("contains a manifest of FastBoot assets", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.manifest).to.deep.equal({
        appFiles: [
          "assets/basic-app.js",
          "assets/basic-app-fastboot.js",
          "example-addon/bar.js",
        ],
        htmlFile: "index.html",
        vendorFiles: [
          "example-addon/foo.js",
          "assets/vendor.js",
          "assets/auto-import-fastboot.js",
          "ember-fetch/fetch-fastboot.js",
        ],
      });
    });

    it("contains a list of allowed hosts from environment.js", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.hostAllowList).to.deep.equal([
        "example.com",
        "subdomain.example.com",
        "/localhost:\\d+/",
      ]);
    });

    it("contains app name", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.appName).to.equal("basic-app");
    });

    it("contains the application config", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      let config = pkg.fastboot.config["basic-app"];

      expect(config.APP.version).to.be;

      delete config.APP.version;
      expect(config).to.deep.equal({
        modulePrefix: "basic-app",
        environment: "development",
        rootURL: "/",
        locationType: "auto",
        EmberENV: {
          EXTEND_PROTOTYPES: {
            Date: false,
          },
          FEATURES: {},
          _APPLICATION_TEMPLATE_WRAPPER: false,
          _DEFAULT_ASYNC_OBSERVERS: true,
          _JQUERY_INTEGRATION: false,
          _TEMPLATE_ONLY_GLIMMER_COMPONENTS: true,
        },
        APP: {
          name: "basic-app",
          autoboot: false,
        },
        fastboot: {
          hostAllowList: [
            "example.com",
            "subdomain.example.com",
            "/localhost:\\d+/",
          ],
        },
        exportApplicationGlobal: true,
      });
    });

    it("contains additional config from example-addon", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.config["foo"]).to.equal("bar");
    });

  });

  describe("with production FastBoot builds", function () {
    before(async function () {
      await execa("yarn", ["build", "--environment=production"]);
    });

    it("contains a manifest of FastBoot assets", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      let manifest = pkg.fastboot.manifest;

      manifest.appFiles.forEach((file) => {
        expect(`dist/${file}`).to.be.a.file();
      });

      expect(`dist/${manifest.htmlFile}`).to.be.a.file();

      manifest.vendorFiles.forEach((file) => {
        expect(`dist/${file}`).to.be.a.file();
      });
    });
  });
});
