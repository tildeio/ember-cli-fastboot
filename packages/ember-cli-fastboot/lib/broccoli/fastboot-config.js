/* eslint-env node */
'use strict';

const fs        = require('fs');
const fmt       = require('util').format;
const uniq      = require('ember-cli-lodash-subset').uniq;
const merge     = require('ember-cli-lodash-subset').merge;
const md5Hex    = require('md5-hex');
const path      = require('path');
const Plugin    = require('broccoli-plugin');
const stringify = require('json-stable-stringify');

const LATEST_SCHEMA_VERSION = 3;

module.exports = class FastBootConfig extends Plugin {
  constructor(inputNode, options) {
    super([inputNode], {
      annotation: 'Generate: FastBoot package.json',
      persistentOutput: true
    });

    this.project = options.project;

    this.name = options.name;
    this.ui = options.ui;
    this.fastbootAppConfig = options.fastbootAppConfig;
    this.outputPaths = options.outputPaths;
    this.appName = options.appConfig.modulePrefix;
    const appConfigModule = `${this.appName}`;
    this.fastbootConfig = {};
    this.fastbootConfig[appConfigModule] = options.appConfig;
    this._fileToChecksumMap = {};

    if (this.fastbootAppConfig && this.fastbootAppConfig.htmlFile) {
      this.htmlFile = this.fastbootAppConfig.htmlFile;
    } else {
      this.htmlFile = 'index.html';
    }

  }


  /**
   * The main hook called by Broccoli Plugin. Used to build or
   * rebuild the tree. In this case, we generate the configuration
   * and write it to `package.json`.
   */
  build() {
    this.buildConfig();
    this.buildDependencies();
    this.buildManifest();
    this.buildHostAllowList();

    let outputPath = path.join(this.outputPath, 'package.json');
    this.writeFileIfContentChanged(outputPath, this.toJSONString());
  }

  writeFileIfContentChanged(outputPath, content) {
    let previous = this._fileToChecksumMap[outputPath];
    let next = md5Hex(content);

    if (previous !== next) {
      fs.writeFileSync(outputPath, content);
      this._fileToChecksumMap[outputPath] = next; // update map
    }
  }

  buildConfig() {
    // we only walk the host app's addons to grab the config since ideally
    // addons that have dependency on other addons would never define
    // this advance hook.
    this.project.addons.forEach((addon) => {
      if (addon.fastbootConfigTree) {
        let configFromAddon = addon.fastbootConfigTree();

        if (!configFromAddon) {
          throw new Error('`fastbootConfigTree` requires a map to be returned');
        }

        merge(this.fastbootConfig, configFromAddon);
      }
    });
  }

  buildDependencies() {
    let dependencies = {};
    let moduleAllowlist = [];
    let ui = this.ui;

    eachAddonPackage(this.project, pkg => {
      let deps = getFastBootDependencies(pkg);

      if (deps) {
        deps.forEach(dep => {
          let version = getDependencyVersion(pkg, dep);

          if (dep in dependencies) {
            version = dependencies[dep];
            ui.writeLine(fmt("Duplicate FastBoot dependency %s. Versions may mismatch. Using range %s.", dep, version), ui.WARNING);
            return;
          }

          moduleAllowlist.push(dep);

          if (version) {
            dependencies[dep] = version;
          }
        });
      }
    });

    let pkg = this.project.pkg;
    let projectDeps = pkg.fastbootDependencies;

    if (projectDeps) {
      projectDeps.forEach(dep => {
        moduleAllowlist.push(dep);

        let version = pkg.dependencies && pkg.dependencies[dep];
        if (version) {
          dependencies[dep] = version;
        }
      });
    }

    this.dependencies = dependencies;
    this.moduleAllowlist = uniq(moduleAllowlist);
  }

  updateFastBootManifest(manifest) {
    this.project.addons.forEach(addon =>{
      if (addon.updateFastBootManifest) {
        manifest = addon.updateFastBootManifest(manifest);

        if (!manifest) {
          throw new Error(`${addon.name} did not return the updated manifest from updateFastBootManifest hook.`);
        }
      }
    });

    return manifest;
  }

  buildManifest() {
    function stripLeadingSlash(filePath) {
      return filePath.replace(/^\//, '');
    }

    let appFilePath = stripLeadingSlash(this.outputPaths.app.js);
    let appFastbootFilePath = appFilePath.replace(/\.js$/, '') + '-fastboot.js';
    let vendorFilePath = stripLeadingSlash(this.outputPaths.vendor.js);

    let manifest = {
      appFiles: [appFilePath, appFastbootFilePath],
      vendorFiles: [vendorFilePath],
      htmlFile: this.htmlFile
    };

    this.manifest = this.updateFastBootManifest(manifest);
  }

  buildHostAllowList() {
    if (this.fastbootAppConfig) {
      if ('hostWhitelist' in this.fastbootAppConfig) {
        this.ui.writeLine('Please update your fastboot config to use `hostAllowList` instead of the deprecated `hostWhitelist`');
      }
      this.hostAllowList = this.fastbootAppConfig.hostAllowList || this.fastbootAppConfig.hostWhitelist
    }
  }

  toJSONString() {
    return stringify({
      dependencies: this.dependencies,
      fastboot: {
        moduleAllowlist: this.moduleAllowlist,
        schemaVersion: LATEST_SCHEMA_VERSION,
        manifest: this.manifest,
        hostAllowList: this.normalizeHostAllowList(),
        config: this.fastbootConfig,
        appName: this.appName,
      }
    }, null, 2);
  }

  normalizeHostAllowList() {
    if (!this.hostAllowList) {
      return;
    }

    return this.hostAllowList.map(function(entry) {
      // Is a regex
      if (entry.source) {
        return '/' + entry.source + '/';
      } else {
        return entry;
      }
    });
  }
}

function eachAddonPackage(project, cb) {
  project.addons.map(addon => cb(addon.pkg));
}

function getFastBootDependencies(pkg) {
  let addon = pkg['ember-addon'];
  if (!addon) {
    return addon;
  }

  if (addon.fastBootDependencies) {
    throw new SilentError('ember-addon.fastBootDependencies has been replaced with ember-addon.fastbootDependencies [addon: ' + pkg.name + ']')
  }

  return addon.fastbootDependencies;
}

function getDependencyVersion(pkg, dep) {
  if (!pkg.dependencies) {
    throw new Error(fmt("Could not find FastBoot dependency '%s' in %s/package.json dependencies.", dep, pkg.name));
  }

  return pkg.dependencies[dep];
}
