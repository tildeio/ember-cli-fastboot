"use strict";

/* jshint ignore:start */



/* jshint ignore:end */

define('fastboot-test/app', ['exports', 'ember', 'fastboot-test/resolver', 'ember-load-initializers', 'fastboot-test/config/environment'], function (exports, _ember, _fastbootTestResolver, _emberLoadInitializers, _fastbootTestConfigEnvironment) {

  var App = undefined;

  _ember['default'].MODEL_FACTORY_INJECTIONS = true;

  App = _ember['default'].Application.extend({
    modulePrefix: _fastbootTestConfigEnvironment['default'].modulePrefix,
    podModulePrefix: _fastbootTestConfigEnvironment['default'].podModulePrefix,
    Resolver: _fastbootTestResolver['default']
  });

  (0, _emberLoadInitializers['default'])(App, _fastbootTestConfigEnvironment['default'].modulePrefix);

  exports['default'] = App;
});
define('fastboot-test/components/app-version', ['exports', 'ember-cli-app-version/components/app-version', 'fastboot-test/config/environment'], function (exports, _emberCliAppVersionComponentsAppVersion, _fastbootTestConfigEnvironment) {

  var name = _fastbootTestConfigEnvironment['default'].APP.name;
  var version = _fastbootTestConfigEnvironment['default'].APP.version;

  exports['default'] = _emberCliAppVersionComponentsAppVersion['default'].extend({
    version: version,
    name: name
  });
});
define('fastboot-test/controllers/array', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller;
});
define('fastboot-test/controllers/object', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller;
});
define('fastboot-test/helpers/pluralize', ['exports', 'ember-inflector/lib/helpers/pluralize'], function (exports, _emberInflectorLibHelpersPluralize) {
  exports['default'] = _emberInflectorLibHelpersPluralize['default'];
});
define('fastboot-test/helpers/singularize', ['exports', 'ember-inflector/lib/helpers/singularize'], function (exports, _emberInflectorLibHelpersSingularize) {
  exports['default'] = _emberInflectorLibHelpersSingularize['default'];
});
define('fastboot-test/initializers/app-version', ['exports', 'ember-cli-app-version/initializer-factory', 'fastboot-test/config/environment'], function (exports, _emberCliAppVersionInitializerFactory, _fastbootTestConfigEnvironment) {
  exports['default'] = {
    name: 'App Version',
    initialize: (0, _emberCliAppVersionInitializerFactory['default'])(_fastbootTestConfigEnvironment['default'].APP.name, _fastbootTestConfigEnvironment['default'].APP.version)
  };
});
define('fastboot-test/initializers/container-debug-adapter', ['exports', 'ember-resolver/container-debug-adapter'], function (exports, _emberResolverContainerDebugAdapter) {
  exports['default'] = {
    name: 'container-debug-adapter',

    initialize: function initialize() {
      var app = arguments[1] || arguments[0];

      app.register('container-debug-adapter:main', _emberResolverContainerDebugAdapter['default']);
      app.inject('container-debug-adapter:main', 'namespace', 'application:main');
    }
  };
});
define('fastboot-test/initializers/data-adapter', ['exports', 'ember'], function (exports, _ember) {

  /*
    This initializer is here to keep backwards compatibility with code depending
    on the `data-adapter` initializer (before Ember Data was an addon).

    Should be removed for Ember Data 3.x
  */

  exports['default'] = {
    name: 'data-adapter',
    before: 'store',
    initialize: _ember['default'].K
  };
});
define('fastboot-test/initializers/ember-data', ['exports', 'ember-data/setup-container', 'ember-data/-private/core'], function (exports, _emberDataSetupContainer, _emberDataPrivateCore) {

  /*

    This code initializes Ember-Data onto an Ember application.

    If an Ember.js developer defines a subclass of DS.Store on their application,
    as `App.StoreService` (or via a module system that resolves to `service:store`)
    this code will automatically instantiate it and make it available on the
    router.

    Additionally, after an application's controllers have been injected, they will
    each have the store made available to them.

    For example, imagine an Ember.js application with the following classes:

    App.StoreService = DS.Store.extend({
      adapter: 'custom'
    });

    App.PostsController = Ember.ArrayController.extend({
      // ...
    });

    When the application is initialized, `App.ApplicationStore` will automatically be
    instantiated, and the instance of `App.PostsController` will have its `store`
    property set to that instance.

    Note that this code will only be run if the `ember-application` package is
    loaded. If Ember Data is being used in an environment other than a
    typical application (e.g., node.js where only `ember-runtime` is available),
    this code will be ignored.
  */

  exports['default'] = {
    name: 'ember-data',
    initialize: _emberDataSetupContainer['default']
  };
});
define('fastboot-test/initializers/export-application-global', ['exports', 'ember', 'fastboot-test/config/environment'], function (exports, _ember, _fastbootTestConfigEnvironment) {
  exports.initialize = initialize;

  function initialize() {
    var application = arguments[1] || arguments[0];
    if (_fastbootTestConfigEnvironment['default'].exportApplicationGlobal !== false) {
      var value = _fastbootTestConfigEnvironment['default'].exportApplicationGlobal;
      var globalName;

      if (typeof value === 'string') {
        globalName = value;
      } else {
        globalName = _ember['default'].String.classify(_fastbootTestConfigEnvironment['default'].modulePrefix);
      }

      if (!window[globalName]) {
        window[globalName] = application;

        application.reopen({
          willDestroy: function willDestroy() {
            this._super.apply(this, arguments);
            delete window[globalName];
          }
        });
      }
    }
  }

  exports['default'] = {
    name: 'export-application-global',

    initialize: initialize
  };
});
define('fastboot-test/initializers/fastboot/ajax', ['exports', 'ember'], function (exports, _ember) {
  var get = _ember['default'].get;

  var nodeAjax = function nodeAjax(options) {
    var httpRegex = /^https?:\/\//;
    var protocolRelativeRegex = /^\/\//;
    var protocol = get(this, 'fastboot.request.protocol') + ':';

    if (protocolRelativeRegex.test(options.url)) {
      options.url = protocol + options.url;
    } else if (!httpRegex.test(options.url)) {
      try {
        options.url = protocol + '//' + get(this, 'fastboot.request.host') + options.url;
      } catch (fbError) {
        throw new Error('You are using Ember Data with no host defined in your adapter. This will attempt to use the host of the FastBoot request, which is not configured for the current host of this request. Please set the hostAllowList property for in your environment.js. FastBoot Error: ' + fbError.message);
      }
    }

    najax(options);
  };

  exports['default'] = {
    name: 'ajax-service',

    initialize: function initialize(application) {
      application.register('ajax:node', nodeAjax, { instantiate: false });
      application.inject('adapter', '_ajaxRequest', 'ajax:node');
      application.inject('adapter', 'fastboot', 'service:fastboot');
    }
  };
});
/* globals najax */
define("fastboot-test/initializers/fastboot/dom-helper-patches", ["exports"], function (exports) {
  /*globals Ember, URL*/
  exports["default"] = {
    name: "dom-helper-patches",

    initialize: function initialize(App) {
      // TODO: remove me
      Ember.HTMLBars.DOMHelper.prototype.protocolForURL = function (url) {
        var protocol = URL.parse(url).protocol;
        return protocol == null ? ':' : protocol;
      };

      // TODO: remove me https://github.com/tildeio/htmlbars/pull/425
      Ember.HTMLBars.DOMHelper.prototype.parseHTML = function (html) {
        return this.document.createRawHTMLSection(html);
      };
    }
  };
});
define('fastboot-test/initializers/fastboot/error-handler', ['exports', 'ember'], function (exports, _ember) {

  /**
   * Initializer to attach an `onError` hook to your app running in fastboot. It catches any run loop
   * exceptions and other errors and prevents the node process from crashing.
   *
   */
  exports['default'] = {
    name: 'error-handler',

    initialize: function initialize(application) {
      if (!_ember['default'].onerror) {
        // if no onerror handler is defined, define one for fastboot environments
        _ember['default'].onerror = function (err) {
          var errorMessage = 'There was an error running your app in fastboot. More info about the error: \n ' + (err.stack || err);
          _ember['default'].Logger.error(errorMessage);
        };
      }
    }
  };
});
define('fastboot-test/initializers/injectStore', ['exports', 'ember'], function (exports, _ember) {

  /*
    This initializer is here to keep backwards compatibility with code depending
    on the `injectStore` initializer (before Ember Data was an addon).

    Should be removed for Ember Data 3.x
  */

  exports['default'] = {
    name: 'injectStore',
    before: 'store',
    initialize: _ember['default'].K
  };
});
define('fastboot-test/initializers/store', ['exports', 'ember'], function (exports, _ember) {

  /*
    This initializer is here to keep backwards compatibility with code depending
    on the `store` initializer (before Ember Data was an addon).

    Should be removed for Ember Data 3.x
  */

  exports['default'] = {
    name: 'store',
    after: 'ember-data',
    initialize: _ember['default'].K
  };
});
define('fastboot-test/initializers/transforms', ['exports', 'ember'], function (exports, _ember) {

  /*
    This initializer is here to keep backwards compatibility with code depending
    on the `transforms` initializer (before Ember Data was an addon).

    Should be removed for Ember Data 3.x
  */

  exports['default'] = {
    name: 'transforms',
    before: 'store',
    initialize: _ember['default'].K
  };
});
define("fastboot-test/instance-initializers/ember-data", ["exports", "ember-data/-private/instance-initializers/initialize-store-service"], function (exports, _emberDataPrivateInstanceInitializersInitializeStoreService) {
  exports["default"] = {
    name: "ember-data",
    initialize: _emberDataPrivateInstanceInitializersInitializeStoreService["default"]
  };
});
define('fastboot-test/resolver', ['exports', 'ember-resolver'], function (exports, _emberResolver) {
  exports['default'] = _emberResolver['default'];
});
define('fastboot-test/router', ['exports', 'ember', 'fastboot-test/config/environment'], function (exports, _ember, _fastbootTestConfigEnvironment) {

  var Router = _ember['default'].Router.extend({
    location: _fastbootTestConfigEnvironment['default'].locationType
  });

  Router.map(function () {});

  exports['default'] = Router;
});
define('fastboot-test/routes/application', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({
    fastboot: _ember['default'].inject.service(),
    shoebox: _ember['default'].computed.readOnly('fastboot.shoebox'),

    model: function model() {
      var fastboot = this.get('fastboot');
      var shoebox = this.get('shoebox');
      if (fastboot.get('isFastBoot')) {
        shoebox.put('key1', { foo: 'bar' });
        shoebox.put('key2', { zip: 'zap' });
        shoebox.put('key3', { htmlSpecialCase: 'R&B > Jazz' });
        shoebox.put('key4', { nastyScriptCase: "<script>alert('owned');</script></script></script>" });
        shoebox.put('key5', { otherUnicodeChars: '&&>><<\u2028\u2028\u2029\u2029' });
      }
    }
  });
});
define('fastboot-test/services/ajax', ['exports', 'ember-ajax/services/ajax'], function (exports, _emberAjaxServicesAjax) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _emberAjaxServicesAjax['default'];
    }
  });
});
define('fastboot-test/services/fastboot', ['exports', 'ember'], function (exports, _ember) {
  var deprecate = _ember['default'].deprecate;
  var computed = _ember['default'].computed;
  var get = _ember['default'].get;
  var deprecatingAlias = computed.deprecatingAlias;
  var readOnly = computed.readOnly;

  var RequestObject = _ember['default'].Object.extend({
    init: function init() {
      this._super.apply(this, arguments);

      var request = this.request;
      delete this.request;

      this.cookies = request.cookies;
      this.headers = request.headers;
      this.queryParams = request.queryParams;
      this.path = request.path;
      this.protocol = request.protocol;
      this._host = function () {
        return request.host();
      };
    },

    host: computed(function () {
      return this._host();
    })
  });

  var Shoebox = _ember['default'].Object.extend({
    // careful calling `this.get`, we're overriding it, use `Ember.get` instead
    put: function put(key, value) {
      _ember['default'].assert('shoebox.put is only invoked from the fastboot rendered application', _ember['default'].get(this, 'fastboot.isFastBoot'));
      _ember['default'].assert('the provided key is a string', typeof key === 'string');

      var fastbootInfo = _ember['default'].get(this, 'fastboot')._fastbootInfo;
      if (!fastbootInfo.shoebox) {
        fastbootInfo.shoebox = {};
      }

      fastbootInfo.shoebox[key] = value;
    },
    get: function get(key) {
      _ember['default'].assert('shoebox.get is only invoked from the browser rendered application', !_ember['default'].get(this, 'fastboot.isFastBoot'));

      var $el = _ember['default'].$('#shoebox-' + key);
      if (!$el.length) {
        return;
      }
      var valueString = $el.text();
      if (!valueString) {
        return;
      }

      return JSON.parse(valueString);
    }
  });

  exports['default'] = _ember['default'].Service.extend({
    cookies: deprecatingAlias('request.cookies', { id: 'fastboot.cookies-to-request', until: '0.9.9' }),
    headers: deprecatingAlias('request.headers', { id: 'fastboot.headers-to-request', until: '0.9.9' }),

    init: function init() {
      this._super.apply(this, arguments);

      var shoebox = Shoebox.create({ fastboot: this });
      this.set('shoebox', shoebox);
    },

    host: computed(function () {
      deprecate('Usage of fastboot service\'s `host` property is deprecated.  Please use `request.host` instead.', false, { id: 'fastboot.host-to-request', until: '0.9.9' });

      return this._fastbootInfo.request.host();
    }),

    response: readOnly('_fastbootInfo.response'),

    request: computed(function () {
      return RequestObject.create({ request: get(this, '_fastbootInfo.request') });
    }),

    isFastBoot: computed(function () {
      return typeof FastBoot !== 'undefined';
    }),

    deferRendering: function deferRendering(promise) {
      _ember['default'].assert('deferRendering requires a promise or thennable object', typeof promise.then === 'function');
      this._fastbootInfo.deferRendering(promise);
    }
  });
});
/* global FastBoot */
define("fastboot-test/templates/application", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["multiple-nodes", "wrong-type"]
        },
        "revision": "Ember@2.3.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 4,
            "column": 0
          }
        },
        "moduleName": "fastboot-test/templates/application.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("h2");
        dom.setAttribute(el1, "id", "title");
        var el2 = dom.createTextNode("Welcome to Ember");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        return morphs;
      },
      statements: [["content", "outlet", ["loc", [null, [3, 0], [3, 10]]]]],
      locals: [],
      templates: []
    };
  })());
});
/* jshint ignore:start */



/* jshint ignore:end */

/* jshint ignore:start */

define('fastboot-test/config/environment', ['ember'], function(Ember) {
  return FastBoot.config();
});

/* jshint ignore:end */

/* jshint ignore:start */


define('~fastboot/app-factory', ['fastboot-test/app', 'fastboot-test/config/environment'], function(App, config) {
  App = App['default'];
  config = config['default'];

  return {
    'default': function() {
      return App.create(config.APP);
    }
  };
});


/* jshint ignore:end */
//# sourceMappingURL=fastboot-test.map
