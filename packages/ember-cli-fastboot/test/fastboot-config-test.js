/* eslint-env node */
'use strict';

const expect = require('chai').expect;
const helpers = require('broccoli-test-helper');
const MockUI = require('console-ui/mock')
const createBuilder = helpers.createBuilder;
const createTempDir = helpers.createTempDir;
const FastbootConfig = require('../lib/broccoli/fastboot-config');


describe('FastbootConfig', function() {
  let input;
  let output;
  let subject;
  let project;

  beforeEach(async function() {
    input = await createTempDir();
    project = {
      addons: [],
      pkg: {},
    };
    subject = new FastbootConfig(input.path(), {
      project,
      outputPaths: {
        app: { js: 'app.js' },
        vendor: { js: 'vendor.js' },
      },
      appConfig: {
        modulePrefix: 'app',
      },
      ui: new MockUI(),
      fastbootAppConfig: {
        hostWhitelist: ['example.com', 'subdomain.example.com']
      }
    });
    output = createBuilder(subject);
  });

  afterEach(async function() {
    await input.dispose();
    await output.dispose();
  });

  it('it replace hostWhitelist with hostAllowList and warns user to update the config to hostAllowList', async function() {
    input.write({});

    await output.build();

    expect(
      output.read()
    ).to.deep.equal({
      'package.json': `{"dependencies":{},"fastboot":{"appName":"app","config":{"app":{"modulePrefix":"app"}},"hostAllowList":["example.com","subdomain.example.com"],"manifest":{"appFiles":["app.js","app-fastboot.js"],"htmlFile":"index.html","vendorFiles":["vendor.js"]},"moduleAllowlist":[],"schemaVersion":3}}`
    });

    expect(output.builder.outputNode.ui.output).to.contain('Please update your fastboot config to use `hostAllowList` instead of the deprecated `hostWhitelist`');
  });
});
