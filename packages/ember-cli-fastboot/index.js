/* eslint-env node */
'use strict';

const path = require('path');
const fs = require('fs');

const MergeTrees = require('broccoli-merge-trees');
const FastBootExpressMiddleware = require('fastboot-express-middleware');
const FastBoot = require('fastboot');
const chalk = require('chalk');

const fastbootAppBoot = require('./lib/utilities/fastboot-app-boot');
const FastBootConfig = require('./lib/broccoli/fastboot-config');
const fastbootAppFactoryModule = require('./lib/utilities/fastboot-app-factory-module');
const migrateInitializers = require('./lib/build-utilities/migrate-initializers');
const SilentError = require('silent-error');

const Concat = require('broccoli-concat');
const Funnel = require('broccoli-funnel');
const p = require('ember-cli-preprocess-registry/preprocessors');
const fastbootTransform = require('fastboot-transform');
const existsSync = fs.existsSync;

let checker;
function getVersionChecker(context) {
  if (!checker) {
    const VersionChecker = require('ember-cli-version-checker');
    checker = new VersionChecker(context);
  }
  return checker;
}

/*
 * Main entrypoint for the Ember CLI addon.
 */
module.exports = {
  name: require('./package').name,

  init() {
    this._super.init && this._super.init.apply(this, arguments);
    this._existsCache = new Map();
  },

  existsSync(path) {
    if (this._existsCache.has(path)) {
      return this._existsCache.get(path);
    }

    const exists = existsSync(path);

    this._existsCache.set(path, exists);
    return exists;
  },

  /**
   * Called at the start of the build process to let the addon know it will be
   * used. Sets the auto run on app to be false so that we create and route app
   * automatically only in browser.
   *
   * See: https://ember-cli.com/user-guide/#integration
   */
  included(app) {
    let assetRev = this.project.addons.find(addon => addon.name === 'broccoli-asset-rev');
    if (assetRev && !assetRev.supportsFastboot) {
      throw new SilentError(
        'This version of ember-cli-fastboot requires a newer version of broccoli-asset-rev'
      );
    }

    // set autoRun to false since we will conditionally include creating app when app files
    // is eval'd in app-boot
    app.options.autoRun = false;

    app.import('vendor/experimental-render-mode-rehydrate.js');

    // get the app registry object and app name so that we can build the fastboot
    // tree
    this._appRegistry = app.registry;
    this._name = app.name;

    this.fastbootOptions = this._fastbootOptionsFor(app.env, app.project);

    migrateInitializers(this.project);
  },

  /**
   * Registers the fastboot shim that allows apps and addons to wrap non-compatible
   * libraries in Node with a FastBoot check using `app.import`.
   *
   */
  importTransforms() {
    return {
      fastbootShim: fastbootTransform,
    };
  },

  /**
   * Inserts placeholders into index.html that are used by the FastBoot server
   * to insert the rendered content into the right spot. Also injects a module
   * for FastBoot application boot.
   */
  contentFor(type, config, contents) {
    if (type === 'body') {
      return '<!-- EMBER_CLI_FASTBOOT_BODY -->';
    }

    if (type === 'head') {
      return '<!-- EMBER_CLI_FASTBOOT_TITLE --><!-- EMBER_CLI_FASTBOOT_HEAD -->';
    }

    if (type === 'app-boot') {
      return fastbootAppBoot(config.modulePrefix, JSON.stringify(config.APP || {}));
    }

    // if the fastboot addon is installed, we overwrite the config-module so that the config can be read
    // from meta tag/directly for browser build and from Fastboot config for fastboot target.
    if (type === 'config-module') {
      const originalContents = contents.join('');
      const appConfigModule = `${config.modulePrefix}`;
      contents.splice(0, contents.length);
      contents.push(
        "if (typeof FastBoot !== 'undefined') {",
        "return FastBoot.config('" + appConfigModule + "');",
        '} else {',
        originalContents,
        '}'
      );
      return;
    }
  },

  treeForFastBoot(tree) {
    let fastbootHtmlBarsTree;

    // check the ember version and conditionally patch the DOM api
    if (this._getEmberVersion().lt('2.10.0-alpha.1')) {
      fastbootHtmlBarsTree = this.treeGenerator(path.resolve(__dirname, 'fastboot-app-lt-2-9'));
      return tree ? new MergeTrees([tree, fastbootHtmlBarsTree]) : fastbootHtmlBarsTree;
    }

    return tree;
  },

  _processAddons(addons, fastbootTrees) {
    addons.forEach(addon => {
      this._processAddon(addon, fastbootTrees);
    });
  },

  _processAddon(addon, fastbootTrees) {
    // walk through each addon and grab its fastboot tree
    const currentAddonFastbootPath = path.join(addon.root, 'fastboot');

    let fastbootTree;
    if (this.existsSync(currentAddonFastbootPath)) {
      fastbootTree = this.treeGenerator(currentAddonFastbootPath);
    }

    // invoke addToFastBootTree for every addon
    if (addon.treeForFastBoot) {
      let additionalFastBootTree = addon.treeForFastBoot(fastbootTree);
      if (additionalFastBootTree) {
        fastbootTrees.push(additionalFastBootTree);
      }
    } else if (fastbootTree !== undefined) {
      fastbootTrees.push(fastbootTree);
    }

    this._processAddons(addon.addons, fastbootTrees);
  },

  /**
   * Function that builds the fastboot tree from all fastboot complaint addons
   * and project and transpiles it into appname-fastboot.js
   */
  _getFastbootTree() {
    const appName = this._name;

    let fastbootTrees = [];

    this._processAddons(this.project.addons, fastbootTrees);
    // check the parent containing the fastboot directory
    const projectFastbootPath = path.join(this.project.root, 'fastboot');
    // ignore the project's fastboot folder if we are an addon, as that is already handled above
    if (!this.project.isEmberCLIAddon() && this.existsSync(projectFastbootPath)) {
      let fastbootTree = this.treeGenerator(projectFastbootPath);
      fastbootTrees.push(fastbootTree);
    }

    // transpile the fastboot JS tree
    let mergedFastBootTree = new MergeTrees(fastbootTrees, {
      overwrite: true,
    });

    let funneledFastbootTrees = new Funnel(mergedFastBootTree, {
      destDir: appName,
    });
    const processExtraTree = p.preprocessJs(funneledFastbootTrees, '/', this._name, {
      registry: this._appRegistry,
    });

    // FastBoot app factory module
    const writeFile = require('broccoli-file-creator');
    let appFactoryModuleTree = writeFile('app-factory.js', fastbootAppFactoryModule(appName));

    let newProcessExtraTree = new MergeTrees([processExtraTree, appFactoryModuleTree], {
      overwrite: true,
    });

    function stripLeadingSlash(filePath) {
      return filePath.replace(/^\//, '');
    }

    let appFilePath = stripLeadingSlash(this.app.options.outputPaths.app.js);
    let finalFastbootTree = new Concat(newProcessExtraTree, {
      outputFile: appFilePath.replace(/\.js$/, '-fastboot.js'),
    });

    return finalFastbootTree;
  },

  treeForPublic(tree) {
    let fastbootTree = this._getFastbootTree();
    let trees = [];
    if (tree) {
      trees.push(tree);
    }
    trees.push(fastbootTree);

    let newTree = new MergeTrees(trees);

    let fastbootConfigTree = this._buildFastbootConfigTree(newTree);

    // Merge the package.json with the existing tree
    return new MergeTrees([newTree, fastbootConfigTree], { overwrite: true });
  },

  /**
   * Need to handroll our own clone algorithm since JSON.stringy changes regex
   * to empty objects which breaks hostWhiteList property of fastboot.
   *
   * @param {Object} config
   */
  _cloneConfigObject(config) {
    if (config === null || typeof config !== 'object') {
      return config;
    }

    if (config instanceof Array) {
      let copy = [];
      for (let i = 0; i < config.length; i++) {
        copy[i] = this._cloneConfigObject(config[i]);
      }

      return copy;
    }

    if (config instanceof RegExp) {
      // converting explicitly to string since we create a new regex object
      // in fastboot: https://github.com/ember-fastboot/fastboot/blob/master/src/fastboot-request.js#L28
      return config.toString();
    }

    if (config instanceof Object) {
      let copy = {};
      for (let attr in config) {
        if (config.hasOwnProperty(attr)) {
          copy[attr] = this._cloneConfigObject(config[attr]);
        }
      }

      return copy;
    }

    throw new Error('App config cannot be cloned for FastBoot.');
  },

  _getHostAppConfig() {
    let env = this.app.env;
    // clone the config object
    let appConfig = this._cloneConfigObject(this.project.config(env));

    // do not boot the app automatically in fastboot. The instance is booted and
    // lives for the lifetime of the request.
    let APP = appConfig.APP;
    if (APP) {
      APP.autoboot = false;
    } else {
      appConfig.APP = { autoboot: false };
    }

    return appConfig;
  },

  _buildFastbootConfigTree(tree) {
    let appConfig = this._getHostAppConfig();
    let fastbootAppConfig = appConfig.fastboot;

    return new FastBootConfig(tree, {
      project: this.project,
      name: this.app.name,
      outputPaths: this.app.options.outputPaths,
      ui: this.ui,
      fastbootAppConfig: fastbootAppConfig,
      appConfig: appConfig,
    });
  },

  serverMiddleware(options) {
    let emberCliVersion = this._getEmberCliVersion();
    let app = options.app;

    if (emberCliVersion.gte('2.12.0-beta.1')) {
      // only run the middleware when ember-cli version for app is above 2.12.0-beta.1 since
      // that version contains API to hook fastboot into ember-cli

      app.use((req, resp, next) => {
        const fastbootQueryParam =
          req.query.hasOwnProperty('fastboot') && req.query.fastboot === 'false' ? false : true;
        const enableFastBootServe = !process.env.FASTBOOT_DISABLED && fastbootQueryParam;

        if (req.serveUrl && enableFastBootServe) {
          // if it is a base page request, then have fastboot serve the base page
          if (!this.fastboot) {
            const broccoliHeader = req.headers['x-broccoli'];
            const outputPath = broccoliHeader['outputPath'];
            const fastbootOptions = Object.assign({}, this.fastbootOptions, {
              distPath: outputPath,
            });

            this.ui.writeLine(chalk.green('App is being served by FastBoot'));
            this.fastboot = new FastBoot(fastbootOptions);
          }

          let fastbootMiddleware = FastBootExpressMiddleware({
            fastboot: this.fastboot,
          });

          fastbootMiddleware(req, resp, next);
        } else {
          // forward the request to the next middleware (example other assets, proxy etc)
          next();
        }
      });
    }
  },

  postBuild(result) {
    if (this.fastboot) {
      // should we reload fastboot if there are only css changes? Seems it maynot be needed.
      // TODO(future): we can do a smarter reload here by running fs-tree-diff on files loaded
      // in sandbox.
      this.ui.writeLine(chalk.blue('Reloading FastBoot...'));
      this.fastboot.reload({
        distPath: result.directory,
      });
    }
  },

  _getEmberCliVersion() {
    const checker = getVersionChecker(this);

    return checker.for('ember-cli', 'npm');
  },

  _getEmberVersion() {
    const checker = getVersionChecker(this);
    const emberVersionChecker = checker.for('ember-source', 'npm');

    if (emberVersionChecker.version) {
      return emberVersionChecker;
    }

    return checker.for('ember', 'bower');
  },

  /**
   * Reads FastBoot configuration from application's `config/fastboot.js` file if present,
   * otherwise returns empty object.
   *
   * The configuration file is expected to export a function with `environment` as an argument,
   * which is same as a how `config/environment.js` works.
   *
   * TODO Allow add-ons to provide own options and merge them with the application's options.
   */
  _fastbootOptionsFor(environment, project) {
    const configPath = path.join(path.dirname(project.configPath()), 'fastboot.js');

    if (fs.existsSync(configPath)) {
      return require(configPath)(environment);
    }
    return {};
  },
};
