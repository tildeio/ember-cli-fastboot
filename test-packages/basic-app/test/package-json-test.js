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

      expect(pkg.fastboot.schemaVersion).to.deep.equal(5);
    });

    it("contains a whitelist of allowed module names", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.moduleWhitelist).to.deep.equal([
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

    it("contains a list of whitelisted hosts from environment.js", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.fastboot.hostWhitelist).to.deep.equal([
        "example.com",
        "subdomain.example.com",
        "/localhost:\\d+/",
      ]);
    });

    it("contains app name", function () {
      let pkg = fs.readJSONSync("dist/package.json");

      expect(pkg.name).to.equal("basic-app");
    });
  });
});
