'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const SimpleDOM = require('simple-dom');
const debug = require('debug')('fastboot:ember-app');

const Sandbox = require('./sandbox');
const FastBootInfo = require('./fastboot-info');
const Result = require('./result');
const { loadConfig } = require('./fastboot-schema');

const Queue = require('./utils/queue');

/**
 * @private
 *
 * The `EmberApp` class serves as a non-sandboxed wrapper around a sandboxed
 * `Ember.Application`. This bridge allows the FastBoot to quickly spin up new
 * `ApplicationInstances` initialized at a particular route, then destroy them
 * once the route has finished rendering.
 */
class EmberApp {
  /**
   * Create a new EmberApp.
   * @param {Object} options
   * @param {string} options.distPath - path to the built Ember application
   * @param {Function} [options.buildSandboxGlobals] - the function used to build the final set of global properties accesible within the sandbox
   * @param {Number} [options.maxSandboxQueueSize] - maximum sandbox queue size when using buildSandboxPerRequest flag.
   */
  constructor(options) {
    this.buildSandboxGlobals = options.buildSandboxGlobals || defaultBuildSandboxGlobals;

    let distPath = (this.distPath = path.resolve(options.distPath));
    let config = loadConfig(distPath);

    this.hostWhitelist = config.hostWhitelist;
    this.config = config.config;
    this.appName = config.appName;
    this.html = config.html;
    this.sandboxRequire = config.sandboxRequire;
    this.registerFastBootInfo = config.registerFastBootInfo;

    if (process.env.APP_CONFIG) {
      let appConfig = JSON.parse(process.env.APP_CONFIG);
      let appConfigKey = this.appName;
      if (!(appConfigKey in appConfig)) {
        this.config[appConfigKey] = appConfig;
      }
    }

    if (process.env.ALL_CONFIG) {
      let allConfig = JSON.parse(process.env.ALL_CONFIG);
      this.config = allConfig;
    }

    this.scripts = buildScripts([
      require.resolve('./scripts/install-source-map-support'),
      ...config.scripts,
    ]);

    // default to 1 if maxSandboxQueueSize is not defined so the sandbox is pre-warmed when process comes up
    const maxSandboxQueueSize = options.maxSandboxQueueSize || 1;
    // Ensure that the dist files can be evaluated and the `Ember.Application`
    // instance created.
    this.buildSandboxQueue(maxSandboxQueueSize);
  }

  /**
   * @private
   *
   * Function to build queue of sandboxes which is later leveraged if application is using `buildSandboxPerRequest`
   * flag. This is an optimization to help with performance.
   *
   * @param {Number} maxSandboxQueueSize - maximum size of queue (this is should be a derivative of your QPS)
   */
  buildSandboxQueue(maxSandboxQueueSize) {
    this._sandboxApplicationInstanceQueue = new Queue(
      () => this.buildNewApplicationInstance(),
      maxSandboxQueueSize
    );

    for (let i = 0; i < maxSandboxQueueSize; i++) {
      this._sandboxApplicationInstanceQueue.enqueue();
    }
  }

  /**
   * @private
   *
   * Builds and initializes a new sandbox to run the Ember application in.
   */
  buildSandbox() {
    const { distPath, buildSandboxGlobals, config, appName, sandboxRequire } = this;

    function fastbootConfig(key) {
      if (!key) {
        // default to app key
        key = appName;
      }

      if (config) {
        return { default: config[key] };
      } else {
        return { default: undefined };
      }
    }

    let defaultGlobals = {
      FastBoot: {
        require: sandboxRequire,
        config: fastbootConfig,

        get distPath() {
          return distPath;
        },
      },
    };

    let globals = buildSandboxGlobals(defaultGlobals);

    return new Sandbox(globals);
  }

  /**
   * Perform any cleanup that is needed
   */
  destroy() {
    if (this._applicationInstance) {
      this._applicationInstance.destroy();
    }
  }

  /**
   * Builds a new application instance sandbox as a micro-task.
   */
  buildNewApplicationInstance() {
    return Promise.resolve().then(() => {
      let app = this.buildApp();
      return app;
    });
  }

  /**
   * @private
   *
   * Creates a new `Application`
   *
   * @returns {Ember.Application} instance
   */
  buildApp() {
    let sandbox = this.buildSandbox();

    debug('adding files to sandbox');

    for (let script of this.scripts) {
      debug('evaluating file %s', script);
      sandbox.runScript(script);
    }

    debug('files evaluated');

    // Retrieve the application factory from within the sandbox
    let AppFactory = sandbox.run(function(ctx) {
      return ctx.require('~fastboot/app-factory');
    });

    // If the application factory couldn't be found, throw an error
    if (!AppFactory || typeof AppFactory['default'] !== 'function') {
      throw new Error(
        'Failed to load Ember app from app.js, make sure it was built for FastBoot with the `ember fastboot:build` command.'
      );
    }

    debug('creating application');

    // Otherwise, return a new `Ember.Application` instance
    let app = AppFactory['default']();

    return app;
  }

  /**
   * @private
   *
   * @param {Promise<instance>} appInstance - the instance that is pre-warmed or built on demand
   * @param {Boolean} isAppInstancePreBuilt - boolean representing how the instance was built
   *
   * @returns {Object}
   */
  getAppInstanceInfo(appInstance, isAppInstancePreBuilt = true) {
    return { app: appInstance, isSandboxPreBuilt: isAppInstancePreBuilt };
  }

  /**
   * @private
   *
   * Get the new sandbox off if it is being created, otherwise create a new one on demand.
   * The later is needed when the current request hasn't finished or wasn't build with sandbox
   * per request turned on and a new request comes in.
   *
   * @param {Boolean} buildSandboxPerVisit if true, a new sandbox will
   *                                       **always** be created, otherwise one
   *                                       is created for the first request
   *                                       only
   */
  async getNewApplicationInstance() {
    const queueObject = this._sandboxApplicationInstanceQueue.dequeue();
    const app = await queueObject.item;

    return this.getAppInstanceInfo(app, queueObject.isItemPreBuilt);
  }

  /**
   * @private
   *
   * Main function that creates the app instance for every `visit` request, boots
   * the app instance and then visits the given route and destroys the app instance
   * when the route is finished its render cycle.
   *
   * Ember apps can manually defer rendering in FastBoot mode if they're waiting
   * on something async the router doesn't know about. This function fetches
   * that promise for deferred rendering from the app.
   *
   * @param {string} path the URL path to render, like `/photos/1`
   * @param {Object} bootOptions An object containing the boot options that are used by
   *                             by ember to decide whether it needs to do rendering or not.
   * @param {Object} result
   * @param {Object} result._fastbootInfo An object holding per request info
   * @param {Boolean} buildSandboxPerVisit if true, a new sandbox will
   *                                       **always** be created, otherwise one
   *                                       is created for the first request
   *                                       only
   * @return {Promise<instance>} instance
   */
  async _visit(path, bootOptions, result, buildSandboxPerVisit) {
    let shouldBuildApp = buildSandboxPerVisit || this._applicationInstance === undefined;

    let { app, isSandboxPreBuilt } = shouldBuildApp
      ? await this.getNewApplicationInstance()
      : this.getAppInstanceInfo(this._applicationInstance);

    if (buildSandboxPerVisit) {
      // entangle the specific application instance to the result, so it can be
      // destroyed when result._destroy() is called (after the visit is
      // completed)
      result.applicationInstance = app;

      // we add analytics information about the current request to know
      // whether it used sandbox from the pre-built queue or built on demand.
      result.analytics.usedPrebuiltSandbox = isSandboxPreBuilt;
    } else {
      // save the created application instance so that we can clean it up when
      // this instance of `src/ember-app.js` is destroyed (e.g. reload)
      this._applicationInstance = app;
    }
    await app.boot();

    let instance = await app.buildInstance();
    result.applicationInstanceInstance = instance;

    this.registerFastBootInfo(result._fastbootInfo, instance);

    await instance.boot(bootOptions);
    await instance.visit(path, bootOptions);
    await result._fastbootInfo.deferredPromise;
  }

  /**
   * Creates a new application instance and renders the instance at a specific
   * URL, returning a promise that resolves to a {@link Result}. The `Result`
   * gives you access to the rendered HTML as well as metadata about the
   * request such as the HTTP status code.
   *
   * If this call to `visit()` is to service an incoming HTTP request, you may
   * provide Node's `ClientRequest` and `ServerResponse` objects as options
   * (e.g., the `res` and `req` arguments passed to Express middleware).  These
   * are provided to the Ember application via the FastBoot service.
   *
   * @param {string} path the URL path to render, like `/photos/1`
   * @param {Object} options
   * @param {string} [options.html] the HTML document to insert the rendered app into
   * @param {Object} [options.metadata] Per request specific data used in the app.
   * @param {Boolean} [options.shouldRender] whether the app should do rendering or not. If set to false, it puts the app in routing-only.
   * @param {Boolean} [options.disableShoebox] whether we should send the API data in the shoebox. If set to false, it will not send the API data used for rendering the app on server side in the index.html.
   * @param {Integer} [options.destroyAppInstanceInMs] whether to destroy the instance in the given number of ms. This is a failure mechanism to not wedge the Node process (See: https://github.com/ember-fastboot/fastboot/issues/90)
   * @param {Boolean} [options.buildSandboxPerVisit] whether to create a new sandbox context per-visit, or reuse the existing sandbox
   * @param {ClientRequest}
   * @param {ClientResponse}
   * @returns {Promise<Result>} result
   */
  async visit(path, options) {
    let req = options.request;
    let res = options.response;
    let html = options.html || this.html;
    let disableShoebox = options.disableShoebox || false;
    let destroyAppInstanceInMs = parseInt(options.destroyAppInstanceInMs, 10);
    let buildSandboxPerVisit = options.buildSandboxPerVisit || false;

    let shouldRender = options.shouldRender !== undefined ? options.shouldRender : true;
    let bootOptions = buildBootOptions(shouldRender);
    let fastbootInfo = new FastBootInfo(req, res, {
      hostWhitelist: this.hostWhitelist,
      metadata: options.metadata,
    });

    let doc = bootOptions.document;
    let result = new Result(doc, html, fastbootInfo);

    // TODO: Use Promise.race here
    let destroyAppInstanceTimer;
    if (destroyAppInstanceInMs > 0) {
      // start a timer to destroy the appInstance forcefully in the given ms.
      // This is a failure mechanism so that node process doesn't get wedged if the `visit` never completes.
      destroyAppInstanceTimer = setTimeout(function() {
        if (result._destroy()) {
          result.error = new Error(
            'App instance was forcefully destroyed in ' + destroyAppInstanceInMs + 'ms'
          );
        }
      }, destroyAppInstanceInMs);
    }

    try {
      await this._visit(path, bootOptions, result, buildSandboxPerVisit);

      if (!disableShoebox) {
        // if shoebox is not disabled, then create the shoebox and send API data
        createShoebox(doc, fastbootInfo.shoebox);
      }
    } catch (error) {
      // eslint-disable-next-line require-atomic-updates
      result.error = error;
    } finally {
      result._finalize();
      // ensure we invoke `Ember.Application.destroy()` and
      // `Ember.ApplicationInstance.destroy()`, but use `result._destroy()` so
      // that the `result` object's internal `this.isDestroyed` flag is correct
      result._destroy();

      clearTimeout(destroyAppInstanceTimer);

      if (buildSandboxPerVisit) {
        // if sandbox was built for this visit, then build a new sandbox for the next incoming request
        // which is invoked using buildSandboxPerVisit
        this._sandboxApplicationInstanceQueue.enqueue();
      }
    }

    return result;
  }
}

/*
 * Builds an object with the options required to boot an ApplicationInstance in
 * FastBoot mode.
 */
function buildBootOptions(shouldRender) {
  let doc = new SimpleDOM.Document();
  let rootElement = doc.body;
  let _renderMode = process.env.EXPERIMENTAL_RENDER_MODE_SERIALIZE ? 'serialize' : undefined;

  return {
    isBrowser: false,
    document: doc,
    rootElement,
    shouldRender,
    _renderMode,
  };
}

/*
 * Writes the shoebox into the DOM for the browser rendered app to consume.
 * Uses a script tag with custom type so that the browser will treat as plain
 * text, and not expend effort trying to parse contents of the script tag.
 * Each key is written separately so that the browser rendered app can
 * parse the specific item at the time it is needed instead of everything
 * all at once.
 */
const hasOwnProperty = Object.prototype.hasOwnProperty; // jshint ignore:line

function createShoebox(doc, shoebox) {
  if (!shoebox) {
    return;
  }

  for (let key in shoebox) {
    if (!hasOwnProperty.call(shoebox, key)) {
      continue;
    } // TODO: remove this later #144, ember-fastboot/ember-cli-fastboot/pull/417
    let value = shoebox[key];
    let textValue = JSON.stringify(value);
    textValue = escapeJSONString(textValue);

    let scriptText = doc.createRawHTMLSection(textValue);
    let scriptEl = doc.createElement('script');

    scriptEl.setAttribute('type', 'fastboot/shoebox');
    scriptEl.setAttribute('id', `shoebox-${key}`);
    scriptEl.appendChild(scriptText);
    doc.body.appendChild(scriptEl);
  }
}

const JSON_ESCAPE = {
  '&': '\\u0026',
  '>': '\\u003e',
  '<': '\\u003c',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

const JSON_ESCAPE_REGEXP = /[\u2028\u2029&><]/g;

function escapeJSONString(string) {
  return string.replace(JSON_ESCAPE_REGEXP, function(match) {
    return JSON_ESCAPE[match];
  });
}

function buildScripts(filePaths) {
  return filePaths.filter(Boolean).map(filePath => {
    let source = fs.readFileSync(filePath, { encoding: 'utf8' });

    return new vm.Script(source, { filename: filePath });
  });
}

function defaultBuildSandboxGlobals(defaultGlobals) {
  return defaultGlobals;
}

module.exports = EmberApp;
