'use strict';



;define("onerror-per-visit/app", ["exports", "onerror-per-visit/resolver", "ember-load-initializers", "onerror-per-visit/config/environment"], function (_exports, _resolver, _emberLoadInitializers, _environment) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  const App = Ember.Application.extend({
    modulePrefix: _environment.default.modulePrefix,
    podModulePrefix: _environment.default.podModulePrefix,
    Resolver: _resolver.default
  });
  (0, _emberLoadInitializers.default)(App, _environment.default.modulePrefix);
  var _default = App;
  _exports.default = _default;
});
;define("onerror-per-visit/initializers/container-debug-adapter", ["exports", "ember-resolver/resolvers/classic/container-debug-adapter"], function (_exports, _containerDebugAdapter) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = {
    name: 'container-debug-adapter',

    initialize() {
      let app = arguments[1] || arguments[0];
      app.register('container-debug-adapter:main', _containerDebugAdapter.default);
      app.inject('container-debug-adapter:main', 'namespace', 'application:main');
    }

  };
  _exports.default = _default;
});
;define("onerror-per-visit/instance-initializers/clear-double-boot", ["exports", "ember-cli-fastboot/instance-initializers/clear-double-boot"], function (_exports, _clearDoubleBoot) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function () {
      return _clearDoubleBoot.default;
    }
  });
});
;define("onerror-per-visit/instance-initializers/setup-onerror", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.initialize = initialize;
  _exports.default = void 0;

  function initialize(owner) {
    let isFastBoot = typeof 'FastBoot' !== 'undefined';
    let fastbootRequestPath;

    if (isFastBoot) {
      let fastbootService = owner.lookup('service:fastboot');
      fastbootRequestPath = fastbootService.request.path;
    } // normally only done in prod builds, but this makes the demo easier


    console.log('setting up error handler ' + fastbootRequestPath);

    Ember.onerror = function (error) {
      if (isFastBoot) {
        error.fastbootRequestPath = fastbootRequestPath;
        throw error;
      }
    };
  }

  var _default = {
    initialize
  };
  _exports.default = _default;
});
;define("onerror-per-visit/locations/none", ["exports", "ember-cli-fastboot/locations/none"], function (_exports, _none) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function () {
      return _none.default;
    }
  });
});
;define("onerror-per-visit/resolver", ["exports", "ember-resolver"], function (_exports, _emberResolver) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = _emberResolver.default;
  _exports.default = _default;
});
;define("onerror-per-visit/router", ["exports", "onerror-per-visit/config/environment"], function (_exports, _environment) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  const Router = Ember.Router.extend({
    location: _environment.default.locationType,
    rootURL: _environment.default.rootURL
  });
  Router.map(function () {
    this.route('slow', {
      path: '/slow/:timeout/:type'
    });
  });
  var _default = Router;
  _exports.default = _default;
});
;define("onerror-per-visit/routes/application", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;

  var _class;

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  let ApplicationRoute = (_class = class ApplicationRoute extends Ember.Route {
    error(error) {
      Ember.onerror(error);
    }

  }, (_applyDecoratedDescriptor(_class.prototype, "error", [Ember._action], Object.getOwnPropertyDescriptor(_class.prototype, "error"), _class.prototype)), _class);
  _exports.default = ApplicationRoute;
});
;define("onerror-per-visit/routes/slow", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;

  class SlowRoute extends Ember.Route {
    model({
      timeout,
      type
    }) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (type === 'reject') {
            let error = new Error("slow route rejected after ".concat(timeout));
            error.code = 'from-slow';
            reject(error);
          } else {
            resolve("slow route rejected after ".concat(timeout));
          }
        }, timeout);
      });
    }

  }

  _exports.default = SlowRoute;
});
;define("onerror-per-visit/services/fastboot", ["exports", "ember-cli-fastboot/services/fastboot"], function (_exports, _fastboot) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function () {
      return _fastboot.default;
    }
  });
});
;define("onerror-per-visit/templates/application", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;

  var _default = Ember.HTMLBars.template({
    "id": "Xv2sNAnW",
    "block": "{\"symbols\":[],\"statements\":[[7,\"h2\",true],[10,\"id\",\"title\"],[8],[0,\"Welcome to Ember\"],[9],[0,\"\\n\\n\"],[1,[22,\"outlet\"],false]],\"hasEval\":false}",
    "meta": {
      "moduleName": "onerror-per-visit/templates/application.hbs"
    }
  });

  _exports.default = _default;
});
;define("onerror-per-visit/templates/slow", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;

  var _default = Ember.HTMLBars.template({
    "id": "CjSxToP7",
    "block": "{\"symbols\":[],\"statements\":[[0,\"Success!\"]],\"hasEval\":false}",
    "meta": {
      "moduleName": "onerror-per-visit/templates/slow.hbs"
    }
  });

  _exports.default = _default;
});
;

;define('onerror-per-visit/config/environment', [], function() {
  if (typeof FastBoot !== 'undefined') {
return FastBoot.config('onerror-per-visit');
} else {
var prefix = 'onerror-per-visit';try {
  var metaName = prefix + '/config/environment';
  var rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
  var config = JSON.parse(decodeURIComponent(rawConfig));

  var exports = { 'default': config };

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

}
});

;
if (typeof FastBoot === 'undefined') {
  if (!runningTests) {
    require('onerror-per-visit/app')['default'].create({});
  }
}

//# sourceMappingURL=onerror-per-visit.map
