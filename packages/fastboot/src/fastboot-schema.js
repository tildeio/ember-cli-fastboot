'use strict';

/*
  This is the only module that should know about differences in the fastboot
  schema version. All other consumers just ask this module for the config and it
  conceals all differences.
*/

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const debug = require('debug')('fastboot:schema');
const resolve = require('resolve');
const getPackageName = require('./utils/get-package-name');
const htmlEntrypoint = require('./html-entrypoint');

/**
 * Map of maintaining schema version history so that transformation of the manifest
 * file can be performed correctly to maintain backward compatibility of older
 * schema version.
 *
 * Note: `latest` schema version should always be updated (and transformation
 * should be added in fastboot lib) everytime fastboot addon schema version is bumped.
 */
const FastBootSchemaVersions = {
  latest: 6, // latest schema version supported by fastboot library
  base: 1, // first schema version supported by fastboot library
  manifestFileArrays: 2, // schema version when app and vendor in manifest supported an array of files
  configExtension: 3, // schema version when FastBoot.config can read arbitrary indexed config
  strictWhitelist: 4, // schema version when fastbootDependencies and whitelist support only package names
  htmlEntrypoint: 5, // schema version where we switch to loading the configuration directly from HTML
  fastbootInfoLookup: 6, // schema version when `info:-fastboot` is looked up by `service:fastboot` instead of inject implicitly
};

/**
 * Given the path to a built Ember app, loads our complete configuration while
 * completely hiding any differences in schema version.
 */
function loadConfig(distPath) {
  let pkgPath = path.join(distPath, 'package.json');
  let file;

  try {
    file = fs.readFileSync(pkgPath);
  } catch (e) {
    throw new Error(
      `Couldn't find ${pkgPath}. You may need to update your version of ember-cli-fastboot.`
    );
  }

  let schemaVersion;
  let pkg;

  try {
    pkg = JSON.parse(file);
    schemaVersion = pkg.fastboot.schemaVersion;
  } catch (e) {
    throw new Error(
      `${pkgPath} was malformed or did not contain a fastboot config. Ensure that you have a compatible version of ember-cli-fastboot.`
    );
  }

  const currentSchemaVersion = FastBootSchemaVersions.latest;
  // set schema version to 1 if not defined
  schemaVersion = schemaVersion || FastBootSchemaVersions.base;
  debug(
    'Current schemaVersion from `ember-cli-fastboot` is %s while latest schema version is %s',
    schemaVersion,
    currentSchemaVersion
  );
  if (schemaVersion > currentSchemaVersion) {
    let errorMsg = chalk.bold.red(
      'An incompatible version between `ember-cli-fastboot` and `fastboot` was found. Please update the version of fastboot library that is compatible with ember-cli-fastboot.'
    );
    throw new Error(errorMsg);
  }

  let appName, config, html, scripts;
  if (schemaVersion < FastBootSchemaVersions.htmlEntrypoint) {
    ({ appName, config, html, scripts } = loadManifest(distPath, pkg.fastboot, schemaVersion));
  } else {
    appName = pkg.name;
    ({ config, html, scripts } = htmlEntrypoint(appName, distPath, pkg.fastboot.htmlEntrypoint));
  }

  let sandboxRequire = buildWhitelistedRequire(
    pkg.fastboot.moduleWhitelist,
    distPath,
    schemaVersion < FastBootSchemaVersions.strictWhitelist
  );

  let registerFastBootInfo = buildRegisterFastBootInfo(
    schemaVersion < FastBootSchemaVersions.fastbootInfoLookup
  );

  return {
    scripts,
    html,
    hostWhitelist: pkg.fastboot.hostWhitelist,
    config,
    appName,
    sandboxRequire,
    registerFastBootInfo,
  };
}

/**
 * Registers this FastBootInfo instance in the registry of an Ember
 * ApplicationInstance. It can be later looked up by the fastboot service
 */
function buildRegisterFastBootInfo(isLegacySchema) {
  return (info, instance) => {
    instance.register('info:-fastboot', info, { instantiate: false });
    if (isLegacySchema) {
      // In legacy fastboot versions, it is implicitly injected
      instance.inject('service:fastboot', '_fastbootInfo', 'info:-fastboot');
    }
  };
}

/**
 * Function to transform the manifest app and vendor files to an array.
 */
function transformManifestFiles(manifest) {
  manifest.appFiles = [manifest.appFile];
  manifest.vendorFiles = [manifest.vendorFile];

  return manifest;
}

function loadManifest(distPath, fastbootConfig, schemaVersion) {
  let manifest = fastbootConfig.manifest;

  if (schemaVersion < FastBootSchemaVersions.manifestFileArrays) {
    // transform app and vendor file to array of files
    manifest = transformManifestFiles(manifest);
  }

  let config = fastbootConfig.config;
  let appName = fastbootConfig.appName;
  if (schemaVersion < FastBootSchemaVersions.configExtension) {
    // read from the appConfig tree
    if (fastbootConfig.appConfig) {
      appName = fastbootConfig.appConfig.modulePrefix;
      config = {};
      config[appName] = fastbootConfig.appConfig;
    }
  }

  let scripts = manifest.vendorFiles.concat(manifest.appFiles).map(function(file) {
    return path.join(distPath, file);
  });
  let html = fs.readFileSync(path.join(distPath, manifest.htmlFile), 'utf8');
  return { appName, config, scripts, html };
}

/**
 * The Ember app runs inside a sandbox that doesn't have access to the normal
 * Node.js environment, including the `require` function. Instead, we provide
 * our own `require` method that only allows whitelisted packages to be
 * requested.
 *
 * This method takes an array of whitelisted package names and the path to the
 * built Ember app and constructs this "fake" `require` function that gets made
 * available globally inside the sandbox.
 *
 * @param {string[]} whitelist array of whitelisted package names
 * @param {string} distPath path to the built Ember app
 * @param {boolean} isLegacyWhiteList flag to enable legacy behavior
 */
function buildWhitelistedRequire(whitelist, distPath, isLegacyWhitelist) {
  whitelist.forEach(function(whitelistedModule) {
    debug('module whitelisted; module=%s', whitelistedModule);

    if (isLegacyWhitelist) {
      let packageName = getPackageName(whitelistedModule);

      if (packageName !== whitelistedModule && whitelist.indexOf(packageName) === -1) {
        console.error("Package '" + packageName + "' is required to be in the whitelist.");
      }
    }
  });

  return function(moduleName) {
    let packageName = getPackageName(moduleName);
    let isWhitelisted = whitelist.indexOf(packageName) > -1;

    if (isWhitelisted) {
      try {
        let resolvedModulePath = resolve.sync(moduleName, { basedir: distPath });
        return require(resolvedModulePath);
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
          return require(moduleName);
        } else {
          throw error;
        }
      }
    }

    if (isLegacyWhitelist) {
      if (whitelist.indexOf(moduleName) > -1) {
        let nodeModulesPath = path.join(distPath, 'node_modules', moduleName);

        if (fs.existsSync(nodeModulesPath)) {
          return require(nodeModulesPath);
        } else {
          return require(moduleName);
        }
      } else {
        throw new Error(
          "Unable to require module '" + moduleName + "' because it was not in the whitelist."
        );
      }
    }

    throw new Error(
      "Unable to require module '" +
        moduleName +
        "' because its package '" +
        packageName +
        "' was not in the whitelist."
    );
  };
}

exports.loadConfig = loadConfig;
