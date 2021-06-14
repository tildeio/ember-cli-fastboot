/* eslint-env node */
'use strict';

const expect = require('chai').expect;
const helpers = require('broccoli-test-helper');
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
    });
    output = createBuilder(subject);
  });

  afterEach(async function() {
    await input.dispose();
    await output.dispose();
  });

  it('it builds only when information changes', async function() {
    input.write({
      'index.js': `export { A } from "./lib/a";`,
      lib: {
        'a.js': `export class A {};`,
        'b.js': `export class B {};`,
        'c.js': `export class C {};`,
      },
    });

    await output.build();

    expect(
      output.read()
    ).to.deep.equal({
      'package.json': `{"dependencies":{},"fastboot":{"appName":"app","config":{"app":{"modulePrefix":"app"}},"manifest":{"appFiles":["app.js","app-fastboot.js"],"htmlFile":"index.html","vendorFiles":["vendor.js"]},"moduleAllowlist":[],"schemaVersion":3}}`
    });

    await output.build();

    expect(output.changes()).to.deep.equal({});

    project.pkg.fastbootDependencies = ['apple', 'orange'];

    project.pkg.dependencies = {
      apple: '*',
      orange: '^1.0.0',
      pizza: '^1.0.0',
    };

    await output.build();

    expect(output.changes()).to.deep.equal({
      'package.json': 'change',
    });

    expect(
      output.read()
    ).to.deep.equal({
      'package.json': `{"dependencies":{"apple":"*","orange":"^1.0.0"},"fastboot":{"appName":"app","config":{"app":{"modulePrefix":"app"}},"manifest":{"appFiles":["app.js","app-fastboot.js"],"htmlFile":"index.html","vendorFiles":["vendor.js"]},"moduleAllowlist":["apple","orange"],"schemaVersion":3}}`
    });

    project.pkg.fastbootDependencies = ['apple', 'orange'];

    project.pkg.dependencies.pizza = '^3.0.0';

    await output.build();

    expect(output.changes()).to.deep.equal({});

    project.pkg.dependencies.apple = '^3.0.0';

    await output.build();

    expect(
      output.read()
    ).to.deep.equal({
      'package.json': `{"dependencies":{"apple":"^3.0.0","orange":"^1.0.0"},"fastboot":{"appName":"app","config":{"app":{"modulePrefix":"app"}},"manifest":{"appFiles":["app.js","app-fastboot.js"],"htmlFile":"index.html","vendorFiles":["vendor.js"]},"moduleAllowlist":["apple","orange"],"schemaVersion":3}}`
    });
  });
});
