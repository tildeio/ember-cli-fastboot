# Ember FastBoot

[![npm version](https://badge.fury.io/js/ember-cli-fastboot.svg)](https://badge.fury.io/js/ember-cli-fastboot)
[![Actions Status](https://github.com/ember-fastboot/ember-cli-fastboot/workflows/CI/badge.svg)](https://github.com/ember-fastboot/ember-cli-fastboot/actions)

FastBoot allows you to render and serve Ember.js apps on the server.
Using FastBoot, you can serve rendered HTML to browsers and
other clients without requiring them to download JavaScript assets.

Currently, the set of Ember applications supported is extremely limited.
As we fix more issues, we expect that set to grow rapidly. See [Known
Limitations](#known-limitations) below for a full-list.

The bottom line is that you should not (yet) expect to install this add-on in
your production app and have FastBoot work.

## Installation

FastBoot requires Ember 2.3 or higher. It is also preferable that your app is running `ember-cli` 2.12.0 and higher.

From within your Ember CLI application, run the following command:

```sh
ember install ember-cli-fastboot
```

## Running

If your app is running `ember-cli` 2.12.0-beta.1+ you can run as follows:

* `ember serve`
* Visit your app at `http://localhost:4200`

You may be shocked to learn that minified code runs faster in Node than
non-minified code, so you will probably want to run the production
environment build for anything "serious."

```sh
ember serve --environment production
```

You can also specify the port (default is 4200):

```sh
ember serve --port 8088
```
See `ember help` for more.

### Disabling FastBoot with `ember serve`

Optionally you can even disable the fastboot serving at runtime using the `fastboot` query parameter. Example to turn off fastboot serving,
visit your app at `http://localhost:4200/?fastboot=false`. If you want to turn on fastboot serving again, simply visit at `http://localhost:4200/?fastboot=true` or `http://localhost:4200/`.

You can even disable serving fastboot with `ember serve` using an environment flag: `FASTBOOT_DISABLED=true ember serve`. If you have disabled building fastboot assets using the same flag as described [here](https://github.com/ember-fastboot/ember-cli-fastboot#double-build-times-and-no-incremental-builds), remember to also disable serving fastboot assets when using `ember serve`.

### FastBoot Configuration

When running locally using `ember serve` you can pass options into FastBoot instance via `config/fastboot.js` file. The configuration file is applicable only for applications, addons are not supported.

```js
module.exports = function(environment) {
  let myGlobal = environment === 'production' ? process.env.MY_GLOBAL : 'testing';

  return {
    buildSandboxGlobals(defaultGlobals) {
      return Object.assign({}, defaultGlobals, {
        myGlobal,
      });
    }
  };
}
```

There are several options available, see FastBoot's [README](./packages/fastboot/#usage) for more information, but be aware that `distPath` is provided internally by `ember-cli-fastboot`, hence it can not be modified by this file.

### FastBoot App Server Configuration

When using [FastBoot App Server](./packages/fastboot-app-server/README.md) for production environment you have to manually pass options from `config/fastboot.js` file.

```js
const FastBootAppServer = require('fastboot-app-server');
const config = require('./config/fastboot')(process.env.NODE_ENV);

let server = new FastBootAppServer({
  distPath: 'dist',
  ...config,
});

server.start();
```

## Using Node/npm Dependencies

### Whitelisting Packages

When your app is running in FastBoot, it may need to use Node packages
to replace features that are available only in the browser.

For security reasons, your Ember app running in FastBoot can only access
packages that you have explicitly whitelisted.

To allow your app to require a package, add it to the
`fastbootDependencies` array in your app's `package.json`:

```js
{
  "name": "my-sweet-app",
  "version": "0.4.2",
  "devDependencies": {
    // ...
  },
  "dependencies": {
    // ...
  },
  "fastbootDependencies": [
    "rsvp",
    "path"
  ]
}
```

The `fastbootDependencies` in the above example means the only node
modules your Ember app can use are `rsvp` and `path`.

If the package you are using is not built-in to Node, **you must also
specify the package and a version in the `package.json` `dependencies`
hash.** Built-in modules (`path`, `fs`, etc.) only need to be added to
`fastbootDependencies`.

### Using Dependencies

From your Ember.js app, you can run `FastBoot.require()` to require a
package. This is identical to the CommonJS `require` except it checks
all requests against the whitelist first.

```js
let path = FastBoot.require('path');
let filePath = path.join('tmp', session.getID());
```

If you attempt to require a package that is not in the whitelist,
FastBoot will raise an exception.

Note that the `FastBoot` global is **only** available when running in
FastBoot mode. You should either guard against its presence or only use
it in FastBoot-only initializers.

## FastBoot Service

FastBoot registers the `fastboot` service. This service allows you to
check if you are running within FastBoot by checking
`fastboot.isFastBoot`. There is also a request object under
`fastboot.request` which exposes details about the current request being
handled by FastBoot

### Delaying the server response

By default, FastBoot waits for the `beforeModel`, `model`, and
`afterModel` hooks to resolve before sending the response back to the
client. If you have asynchrony that runs outside of those contexts, your
response may not reflect the state that you want.

To solve this, the `fastboot` service has `deferRendering` method that accepts
a promise. It will chain all promises passed to it, and the FastBoot server will
wait until all of these promises resolve before sending the response to
the client. These promises must be chained before the rendering is
complete after the model hooks. For example, if a component that is
rendered into the page makes an async call for data, registering a
promise to be resolved in its `init` hook would allow the component to
defer the rendering of the page.

The following example demonstrates how the `deferRendering` method can be
used to ensure posts data has been loaded asynchronously by a component before
rendering the entire page. Note how the call should be wrapped in a `fastboot.isFastBoot`
check since the method will throw an exception outside of that context:

```js
import Ember from 'ember';

export default Ember.Component.extend({
  fastboot: Ember.inject.service(),
  model: Ember.inject.service(),

  init() {
    this._super(...arguments);

    let promise = this.get('store').findAll('post').then((posts) => {
      this.set('posts', posts);
    });

    if (this.get('fastboot.isFastBoot')) {
      this.get('fastboot').deferRendering(promise);
    }
  }
});
```

### Cookies

You can access cookies for the current request via `fastboot.request`
in the `fastboot` service.

```js
export default Ember.Route.extend({
  fastboot: Ember.inject.service(),

  model() {
    let authToken = this.get('fastboot.request.cookies.auth');
    // ...
  }
});
```

The service's `cookies` property is an object containing the request's
cookies as key/value pairs.

### Headers

You can access the headers for the current request via `fastboot.request`
in the `fastboot` service. The `headers` object implements part of the
[Fetch API's Headers
class](https://developer.mozilla.org/en-US/docs/Web/API/Headers), the
functions available are
[`has`](https://developer.mozilla.org/en-US/docs/Web/API/Headers/has),
[`get`](https://developer.mozilla.org/en-US/docs/Web/API/Headers/get), and
[`getAll`](https://developer.mozilla.org/en-US/docs/Web/API/Headers/getAll).

```js
export default Ember.Route.extend({
  fastboot: Ember.inject.service(),

  model() {
    let headers = this.get('fastboot.request.headers');
    let xRequestHeader = headers.get('X-Request');
    // ...
  }
});
```

### Host

You can access the host of the request that the current FastBoot server
is responding to via `fastboot.request` in the `fastboot` service. The
`host` property will return the host (`example.com` or `localhost:3000`).

```js
export default Ember.Route.extend({
  fastboot: Ember.inject.service(),

  model() {
    let host = this.get('fastboot.request.host');
    // ...
  }
});
```

To retrieve the host of the current request, you must specify a list of
hosts that you expect in your `config/environment.js`:

```js
module.exports = function(environment) {
  var ENV = {
    modulePrefix: 'host',
    environment: environment,
    baseURL: '/',
    locationType: 'auto',
    EmberENV: {
      // ...
    },
    APP: {
      // ...
    },

    fastboot: {
      hostWhitelist: ['example.com', 'subdomain.example.com', /^localhost:\d+$/]
    }
  };
  // ...
};
```

The `hostWhitelist` can be a string or RegExp to match multiple hosts.
Care should be taken when using a RegExp, as the host function relies on
the `Host` HTTP header, which can be forged. You could potentially allow
a malicious request if your RegExp is too permissive when using the `host`
when making subsequent requests.

Retrieving `host` will error on 2 conditions:

 1. you do not have a `hostWhitelist` defined
 2. the `Host` header does not match an entry in your `hostWhitelist`

### Query Parameters

You can access query parameters for the current request via `fastboot.request`
in the `fastboot` service.

```js
export default Ember.Route.extend({
  fastboot: Ember.inject.service(),

  model() {
    let authToken = this.get('fastboot.request.queryParams.auth');
    // ...
  }
});
```

The service's `queryParams` property is an object containing the request's
query parameters as key/value pairs.

### Path

You can access the path (`/` or `/some-path`) of the request that the
current FastBoot server is responding to via `fastboot.request` in the
`fastboot` service.

```js
export default Ember.Route.extend({
  fastboot: Ember.inject.service(),

  model() {
    let path = this.get('fastboot.request.path');
    // ...
  }
});
```

### Protocol

You can access the protocol (`http:` or `https:`) of the request that the
current FastBoot server is responding to via `fastboot.request` in the
`fastboot` service.

```js
export default Ember.Route.extend({
  fastboot: Ember.inject.service(),

  model() {
    let protocol = this.get('fastboot.request.protocol');
    // ...
  }
});
```

### The Shoebox

You can pass application state from the FastBoot rendered application
to the browser rendered application using a feature called the "Shoebox".
This allows you to leverage server API calls made by the FastBoot
rendered application on the browser rendered application. Thus preventing
you from duplicating work that the FastBoot application is performing.
This should result in a performance benefit for your browser application,
as it does not need to issue server API calls whose results are available
from the Shoebox.

The contents of the Shoebox are written to the HTML as strings within
`<script>` tags by the server rendered application, which are then
consumed by the browser rendered application.

This looks like:

```html
<script type="fastboot/shoebox" id="shoebox-main-store">
{"data":[{"attributes":{"name":"AEC Professionals"},"id":106,"type":"audience"},
{"attributes":{"name":"Components"},"id":111,"type":"audience"},
{"attributes":{"name":"Emerging Professionals"},"id":116,"type":"audience"},
{"attributes":{"name":"Independent Voters"},"id":2801,"type":"audience"},
{"attributes":{"name":"Staff"},"id":141,"type":"audience"},
{"attributes":{"name":"Students"},"id":146,"type":"audience"}]}
</script>
```

You can add items into the shoebox with `shoebox.put`, and you can retrieve
items from the shoebox using `shoebox.retrieve`. In the example below we use
an object, `shoeboxStore`, that acts as our store of objects that reside in
the shoebox. We can then add/remove items from the `shoeboxStore` in the
FastBoot rendered application as we see fit. Then in the browser rendered
application, it will grab the `shoeboxStore` from the shoebox and retrieve
the record necessary for rendering this route.

```js
export default Ember.Route.extend({
  fastboot: Ember.inject.service(),

  model(params) {
    let shoebox = this.get('fastboot.shoebox');
    let shoeboxStore = shoebox.retrieve('my-store');

    if (this.get('fastboot.isFastBoot')) {
      return this.store.findRecord('post', params.post_id).then(post => {
        if (!shoeboxStore) {
          shoeboxStore = {};
          shoebox.put('my-store', shoeboxStore);
        }
        shoeboxStore[post.id] = post.toJSON();
      });
    } else {
      return shoeboxStore && shoeboxStore[params.post_id];
    }
  }
});
```

### Think out of the Shoebox

Shoebox gives you great capabilities, but using it in the real app is pretty rough. Have you ever thought that such kind of logic should be done behind the scenes? In a large codebase, defining `fastboot.isFastBoot` conditionals can be a daunting task. Furthermore, it generates a lot of boilerplate code, which obscures the solution. Sooner or later coupling with `shoebox` will spread over all routes.

#### Solution: Application Adapter

One way to abstract the shoebox data storage mechanics is to move the logic into
the Application Adapter as shown below.

```js
export default class ApplicationAdapter extends JSONAPIAdapter.extend(
  // ...snip...

  cacheKeyFor([, model, id]) {
    return (model.modelName && id) ? `${model.modelName}-${id}` : 'default-store';
  }

  async findRecord() {
    const key = this.cacheKeyFor(arguments);

    if (this.fastboot.isFastBoot) {
      let result = await super.findRecord(...arguments);

      // must deep-copy for clean serialization.
      result = JSON.parse(JSON.stringify(result));

      this.fastboot.shoebox.put(key, result);

      return result;
    }

    let result = this.fastboot.shoebox.retrieve(key);

    if (!result) {
      result = await super.findRecord(...arguments);
    }

    // must deep-copy for clean serialization.
    return JSON.parse(JSON.stringify(result));
  }
}
```

With this strategy, any time an ember-data `findRecord` request happens while in
Fastboot mode, the record will be put into the shoebox cache and returned. When
subsequent calls are made for that record in the hydrated application, it will
first check the shoebox data.

#### Solution: Use an Addon (ember-storefront)

Additionally, there is an addon called [ember-data-storefront](https://embermap.github.io/ember-data-storefront/) that can help to alleviate this pain, thanks to its Fastboot mixin: https://embermap.github.io/ember-data-storefront/docs/guides/fastboot.

After installing the addon and applying the mixin, your routes can look like this:

`app/routes/my-route.js`:

```javascript
import Route from '@ember/routing/route';

export default  Route.extend({
  model() {
    // first call in a server makes actual ajax request.
    // second call in a browser serves cached response
    return this.store.findAll('posts')
  }
})
```
And they still take advantage of caching in the `shoebox`. No more redundant AJAX for already acquired data. Installation details are available in the addon [documentation](https://embermap.github.io/ember-data-storefront/docs).

### Rehydration

What is Rehydration?

The rehydration feature means that the Glimmer VM can take a DOM tree
created using Server Side Rendering (SSR) and use it as the starting
point for the append pass.

See details here:

https://github.com/glimmerjs/glimmer-vm/commit/316805b9175e01698120b9566ec51c88d075026a

In order to utilize rehydration in Ember.js applications we need to ensure that
both server side renderers (like fastboot) properly encode the DOM they send to
the browser with the serialization format (introduced in the commit above) AND
that the browser instantiated Ember.js application knows to use the rehydration
builder to consume that DOM.

Rehydration is 100% opt-in, if you do not specify the environment flag your
application will behave as it did before!

We can opt-in to the rehydration filter by setting the following environment
flag:

```
EXPERIMENTAL_RENDER_MODE_SERIALIZE=true
```

This flag is read by Ember CLI Fastboot's dependency; fastboot to alert it to
produce DOM with the glimmer-vm's serialization element builder.  This addon
(Ember CLI Fastboot) then uses a utility function from glimmer-vm that allows
it to know whether or not the DOM it received in the browser side was generated
by the serialization builder.  If it was, it tells the Ember.js Application to
use the rehydration builder and your application will be using rehydration.

Rehydration is only compatible with fastboot > 1.1.4-beta.1, and Ember.js > 3.2.

## Build Hooks for FastBoot

### Disabling incompatible dependencies

There are two places where the inclusion of incompatible JavaScript libraries could
occur:

#### `app.import` in the application's `ember-cli-build.js`

If your Ember application is importing an incompatible Javascript library,you can use `app.import` with the `using` API.

```js
app.import('vendor/fastboot-incompatible.js', {
  using: [
    {
      transformation: 'fastbootShim'
    }
  ]
});
```
#### `app.import` in an addon's `included` hook

You can include the incompatible Javascript libraries by wrapping them with a `FastBoot` variable check. In the browser, `FastBoot` global variable is not defined.

```js
var map = require('broccoli-stew').map;

treeForVendor(defaultTree) {
  var browserVendorLib = new Funnel(...);

  browserVendorLib = map(browserVendorLib, (content) => `if (typeof FastBoot === 'undefined') { ${content} }`);

  return new mergeTrees([defaultTree, browserVendorLib]);
}

included() {
  // this file will be loaded in FastBoot but will not be eval'd
  app.import('vendor/<browserLibName>.js');
}
```

*Note*: `ember-cli-fastboot` will no longer provide the `EMBER_CLI_FASTBOOT` environment variable to differentiate browser and fastboot builds with rc builds and FastBoot 1.0 and above.

### Loading additional assets in FastBoot environment

Often addons require to load libraries that are specific to the FastBoot environment and only need to be loaded on the server side. This can include loading
libraries before or after the vendor file is loaded in the sandbox and/or before or after the app file is loaded in the sandbox. Since the FastBoot manifest defines
an array of vendor and app files to load in the sandbox, an addon can define additional vendor/app files to load in the sandbox as well.

If your addon requires to load something in the sandbox: you can define the `updateFastBootManifest` hook from your addon (in `index.js`):

```js
updateFastBootManifest(manifest) {
  /**
   * manifest is an object containing:
   * {
   *    vendorFiles: [<path of the vendor file to load>, ...],
   *    appFiles: [<path of the app file to load>, ...],
   *    htmlFile: '<path of the base page that should be served by FastBoot>'
   * }
   */

   // This will load the foo.js before vendor.js is loaded in sandbox
   manifest.vendorFiles.unshift('<path to foo.js under dist>');
   // This will load bar.js after app.js is loaded in the sandbox
   manifest.appFiles.push('<path to bar.js under dist>');

   // remember to return the updated manifest, otherwise your build will fail.
   return manifest;
}
```

*Note*: `process.env.EMBER_CLI_FASTBOOT` will be removed in RC builds and FastBoot 1.0.
Therefore, if you are relying on this environment variable to import something in the fastboot environment, you should instead use `updateFastBootManifest` hook.

### Conditionally include assets in FastBoot asset

Often your addon may need to conditionally include additional app trees based on ember version. Example, Ember changed an API and in order to have your addon be backward compatible for the API changes you want to include an asset when the ember version is x. For such usecases you could define the `treeForFastBoot` hook in your addon's `index.js` as below:

```js
treeForFastBoot: function(tree) {
  let fastbootHtmlBarsTree;

  // check the ember version and conditionally patch the DOM api
  if (this._getEmberVersion().lt('2.10.0-alpha.1')) {
    fastbootHtmlBarsTree = this.treeGenerator(path.resolve(__dirname, 'fastboot-app-lt-2-9'));
    return tree ? new MergeTrees([tree, fastbootHtmlBarsTree]) : fastbootHtmlBarsTree;
  }

  return tree;
},
```

The `tree` is the additional fastboot asset that gets generated and contains the fastboot overrides.

### Providing additional config

By default `ember-cli-fastboot` reads the app's config and provides it in the FastBoot sandbox as a JSON object. For the app in browser, it respects `storeConfigInMeta` and either reads it from the config meta tag or inlines it as JSON object in the `app-name/config/environment` AMD module.

Addons like ember-engines may split the app in different bundles that are loaded asynchronously. Since each bundle is loaded asynchronously, it can have its own configuration as well. In order to allow FastBoot to provide this config in the sandbox, it exposes a `fastbootConfigTree` build hook.

Addons wishing to use this hook simply need to return a unique identifier for the configuration with the configuration.

```js
fastbootConfigTree() {
  return {
    '<engine-name>': {
      'foo': 'bar'
    }
  }
}
```

The above configuration will be available in Node via the `FastBoot.config()` function. Therefore, in order to get the above config, the addon/app can call `FastBoot.config('<engine-name>')`.

## Known Limitations

While FastBoot is under active development, there are several major
restrictions you should be aware of. Only the most brave should even
consider deploying this to production.

### No `didInsertElement`

Since `didInsertElement` hooks are designed to let your component
directly manipulate the DOM, and that doesn't make sense on the server
where there is no DOM, we do not invoke either `didInsertElement` or
`willInsertElement` hooks. The only component lifecycle hooks called in
FastBoot are `init`, `didReceiveAttrs`, `didUpdateAttrs`, and `willDestroy`.

### No jQuery

Running most of jQuery requires a full DOM. Most of jQuery will just not be
supported when running in FastBoot mode. One exception is network code for
fetching models, which we intended to support, but doesn't work at
present.

### Prototype extensions

Prototype extensions do not currently work across node "realms."  Fastboot
applications operate in two realms, a normal node environment and a [virtual machine](https://nodejs.org/api/vm.html).  Passing objects that originated from the normal realm will not contain the extension methods
inside of the sandbox environment. For this reason, it's encouraged to [disable prototype extensions](https://guides.emberjs.com/v2.4.0/configuring-ember/disabling-prototype-extensions/).

## Troubleshooting

Because your app is now running in Node.js, not the browser, you'll
need a new set of tools to diagnose problems when things go wrong. Here
are some tips and tricks we use for debugging our own apps.

### Verbose Logging

Enable verbose logging by running the FastBoot server with the following
environment variables set:

```sh
DEBUG=ember-cli-fastboot:* ember serve
```

PRs adding or improving logging facilities are very welcome.

### Developer Tools

Thanks to recent improvements in NodeJS it is now possible to get a
debugging environment that you can connect to with Chrome DevTools (version 55+).
You can find more information on the new debugging method on Node's
[official documentation](https://nodejs.org/en/docs/inspector/) but here is a quick-start guide:

First let's start up the FastBoot server with Node in debug mode. One thing
about debug mode: it makes everything much slower.

```sh
node --inspect-brk ./node_modules/.bin/ember serve
```

This starts the FastBoot server in debug mode. Note that the `--inspect-brk` flag will cause your
app to start paused to give you a chance to open the debugger.

Once you see the output `Debugger listening on ws://127.0.0.1:<port>/<guid>`, open Chrome
and visit [chrome://inspect](chrome://inspect). Once it loads you should see an Ember target
with a link "inspect" underneath. Click inspect and it should pop up a Chrome inspector
window and you can click the ▶︎ icon to let FastBoot continue loading.

Assuming your app loads without an exception, after a few seconds you
will see a message that FastBoot is listening on port 3000. Once you see
that, you can open a connection; any exceptions should be logged in the
console, and you can use the tools you'd expect such as `console.log`,
`debugger` statements, etc.

#### Note Regarding Node Versions

The above method only started working for the v8.x track of Node after version v8.4.0,
which has a fix to [this issue](https://github.com/nodejs/node/issues/7593). If you
are using any versions between v8.0 and v8.4 we would recommend upgrading to at least v8.4.0

For any versions prior to 6.4 the previous version of this documentation is still valid.
Please follow those instructions [here](https://github.com/ember-fastboot/ember-cli-fastboot/tree/v1.0.4#developer-tools)

### Service Workers

[Service workers](https://developers.google.com/web/fundamentals/primers/service-workers/) should be [disabled](https://github.com/ember-fastboot/ember-cli-fastboot/issues/572#issuecomment-364468056) for development builds, otherwise your app may not be served via FastBoot. Instructions on how to do this for [ember-service-worker](http://ember-service-worker.com/) can be found [here](http://ember-service-worker.com/documentation/configuration/#disabling-the-service-worker).

## Tests

Run the automated tests by running `npm test`.

Note that the integration tests create new Ember applications via `ember
new` and thus have to run an `npm install`, which can take several
minutes, particularly on slow connections.

To speed up test runs you can run `npm run test:precook` to "precook" a
`node_modules` directory that will be reused across test runs.

### Debugging Integration Tests

Run the tests with the `DEBUG` environment variable set to
`fastboot-test` to see verbose debugging output.

```sh
DEBUG=fastboot-test npm test
```

### Questions

Reach out to us via [Ember Community Discord](https://discordapp.com/invite/zT3asNS) in the `#fastboot` channel.
