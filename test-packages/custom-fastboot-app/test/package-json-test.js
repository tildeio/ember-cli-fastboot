"use strict";

const chai = require("chai");
const expect = chai.expect;
const fs = require("fs-extra");
const execa = require("execa");

chai.use(require("chai-fs"));

describe("generating package.json", function () {
  this.timeout(300000);

  describe('with customized fingerprinting options', function() {

    before(async function () {
      await execa("yarn", ["build:prod"]);
    });

    it("builds a package.json", async function () {
      expect("dist/totally-customized-asset-map.json").to.be.a.file();
      expect("dist/package.json").to.be.a.file();
    });

    it('respects a custom asset map path and prepended URLs', function() {
      expect("dist/totally-customized-asset-map.json").to.be.a.file();
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

    it('respects individual files being excluded from fingerprinting', function() {
      expect("dist/totally-customized-asset-map.json").to.be.a.file();

      let pkg = fs.readJSONSync("dist/package.json");
      let manifest = pkg.fastboot.manifest;

      // custom-fastboot-app is excluded from fingerprinting
      expect(manifest.appFiles).to.include('assets/custom-fastboot-app.js');
      // vendor.js is excluded from fingerprinting
      expect(manifest.vendorFiles).to.include('assets/vendor.js');
    });

    describe('with custom htmlFile', function() {
      it('uses custom htmlFile in the manifest', function() {
        let pkg = fs.readJSONSync("dist/package.json");
        let { htmlEntrypoint} = pkg.fastboot;

        expect(htmlEntrypoint).to.equal('custom-index.html');
        expect(`dist/${htmlEntrypoint}`).to.be.a.file();
      });
    });
  });
});
