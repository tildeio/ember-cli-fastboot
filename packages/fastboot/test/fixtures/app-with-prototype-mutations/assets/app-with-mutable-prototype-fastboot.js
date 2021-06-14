define('~fastboot/app-factory', ['app-with-mutable-prototype/app', 'app-with-mutable-prototype/config/environment'], function(App, config) {
  App = App['default'];
  config = config['default'];

  return {
    'default': function() {
      return App.create(config.APP);
    }
  };
});

define("app-with-mutable-prototype/initializers/ajax", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  const {
    get
  } = Ember;

  var nodeAjax = function (options) {
    let httpRegex = /^https?:\/\//;
    let protocolRelativeRegex = /^\/\//;
    let protocol = get(this, 'fastboot.request.protocol');

    if (protocolRelativeRegex.test(options.url)) {
      options.url = protocol + options.url;
    } else if (!httpRegex.test(options.url)) {
      try {
        options.url = protocol + '//' + get(this, 'fastboot.request.host') + options.url;
      } catch (fbError) {
        throw new Error('You are using Ember Data with no host defined in your adapter. This will attempt to use the host of the FastBoot request, which is not configured for the current host of this request. Please set the hostAllowList property for in your environment.js. FastBoot Error: ' + fbError.message);
      }
    }

    if (najax) {
      najax(options);
    } else {
      throw new Error('najax does not seem to be defined in your app. Did you override it via `addOrOverrideSandboxGlobals` in the fastboot server?');
    }
  };

  var _default = {
    name: 'ajax-service',
    initialize: function (application) {
      application.register('ajax:node', nodeAjax, {
        instantiate: false
      });
      application.inject('adapter', '_ajaxRequest', 'ajax:node');
      application.inject('adapter', 'fastboot', 'service:fastboot');
    }
  };
  _exports.default = _default;
});
define("app-with-mutable-prototype/initializers/error-handler", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;

  /**
   * Initializer to attach an `onError` hook to your app running in fastboot. It catches any run loop
   * exceptions and other errors and prevents the node process from crashing.
   *
   */
  var _default = {
    name: 'error-handler',
    initialize: function () {
      if (!Ember.onerror) {
        // if no onerror handler is defined, define one for fastboot environments
        Ember.onerror = function (err) {
          const errorMessage = "There was an error running your app in fastboot. More info about the error: \n ".concat(err.stack || err);
          console.error(errorMessage);
        };
      }
    }
  };
  _exports.default = _default;
});//# sourceMappingURL=app-with-mutable-prototype-fastboot.map
