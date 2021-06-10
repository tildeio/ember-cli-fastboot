/* eslint-env node */
'use strict';

const fs = require('fs');
const fmt = require('util').format;
const uniq = require('ember-cli-lodash-subset').uniq;
const merge = require('ember-cli-lodash-subset').merge;
const md5Hex = require('md5-hex');
const path = require('path');
const Plugin = require('broccoli-plugin');

const stringify = require('json-stable-stringify');

const LATEST_SCHEMA_VERSION = 5;

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

    this.prepareConfig();
    this.prepareDependencies();
  }

  /**
   * The main hook called by Broccoli Plugin. Used to build or
   * rebuild the tree. In this case, we generate the configuration
   * and write it to `package.json`.
   */
  build() {
    this.buildHostWhitelist();
    let outputPath = path.join(this.outputPath, 'package.json');
    this.writeFileIfContentChanged(outputPath, this.toJSONString());
  }

  get manifest() {
    if (!this._manifest) {
      this._manifest = this.buildManifest();
    }
    return this._manifest;
  }

  writeFileIfContentChanged(outputPath, content) {
    let previous = this._fileToChecksumMap[outputPath];
    let next = md5Hex(content);

    if (previous !== next) {
      fs.writeFileSync(outputPath, content);
      this._fileToChecksumMap[outputPath] = next; // update map
    }
  }

  prepareConfig() {
    // we only walk the host app's addons to grab the config since ideally
    // addons that have dependency on other addons would never define
    // this advance hook.
    this.project.addons.forEach(addon => {
      if (addon.fastbootConfigTree) {
        let configFromAddon = addon.fastbootConfigTree();

        if (!configFromAddon) {
          throw new Error('`fastbootConfigTree` requires a map to be returned');
        }

        merge(this.fastbootConfig, configFromAddon);
      }
    });
  }

  prepareDependencies() {
    let dependencies = {};
    let moduleWhitelist = [];
    let ui = this.ui;

    eachAddonPackage(this.project, pkg => {
      let deps = getFastBootDependencies(pkg);

      if (deps) {
        deps.forEach(dep => {
          let version = getDependencyVersion(pkg, dep);

          if (dep in dependencies) {
            version = dependencies[dep];
            ui.writeLine(
              fmt('Duplicate FastBoot dependency %s. Versions may mismatch. Using range %s.', dep, version),
              ui.WARNING
            );
            return;
          }

          moduleWhitelist.push(dep);

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
        moduleWhitelist.push(dep);

        let version = pkg.dependencies && pkg.dependencies[dep];
        if (version) {
          dependencies[dep] = version;
        }
      });
    }

    this.dependencies = dependencies;
    this.moduleWhitelist = uniq(moduleWhitelist);
  }

  updateFastBootManifest(manifest) {
    this.project.addons.forEach(addon => {
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

    return this.updateFastBootManifest(manifest);
  }

  buildHostWhitelist() {
    if (this.fastbootAppConfig) {
      this.hostWhitelist = this.fastbootAppConfig.hostWhitelist;
    }
  }

  toJSONString() {
    return stringify(
      {
        name: this.appName,
        dependencies: this.dependencies,
        fastboot: {
          moduleWhitelist: this.moduleWhitelist,
          schemaVersion: LATEST_SCHEMA_VERSION,
          hostWhitelist: this.normalizeHostWhitelist(),
          // We can't drop manifest until broccoli-asset-rev also supports v5 HTML based manifest
          // https://github.com/ember-cli/broccoli-asset-rev/blob/78f6047c15acb3bd348611f658b03bdd1041911f/lib/fastboot-manifest-rewrite.js
          manifest: this.manifest,
          htmlEntrypoint: this.manifest.htmlFile
        }
      },
      null,
      2
    );
  }

  normalizeHostWhitelist() {
    if (!this.hostWhitelist) {
      return;
    }

    return this.hostWhitelist.map(function(entry) {
      // Is a regex
      if (entry.source) {
        return '/' + entry.source + '/';
      } else {
        return entry;
      }
    });
  }
};

function eachAddonPackage(project, cb) {
  project.addons.map(addon => cb(addon.pkg));
}

function getFastBootDependencies(pkg) {
  let addon = pkg['ember-addon'];
  if (!addon) {
    return addon;
  }

  if (addon.fastBootDependencies) {
    throw new SilentError(
      'ember-addon.fastBootDependencies has been replaced with ember-addon.fastbootDependencies [addon: ' +
        pkg.name +
        ']'
    );
  }

  return addon.fastbootDependencies;
}

function getDependencyVersion(pkg, dep) {
  if (!pkg.dependencies) {
    throw new Error(fmt("Could not find FastBoot dependency '%s' in %s/package.json dependencies.", dep, pkg.name));
  }

  return pkg.dependencies[dep];
}
