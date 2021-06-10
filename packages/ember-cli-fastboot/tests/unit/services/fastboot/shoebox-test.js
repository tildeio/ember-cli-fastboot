import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import sinon from 'sinon';

let sandbox;

module('Unit | Service | fastboot | shoebox', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  hooks.afterEach(function() {
    sandbox.restore();
  });

  test('retrieve returns value if isFastBoot false and key is cached', function(assert) {
    let service = this.owner.lookup('service:fastboot');

    service.set('shoebox.foo', 'bar');

    assert.strictEqual(service.get('shoebox').retrieve('foo'), 'bar');
  });

  test('retrieve returns undefined if isFastBoot false and shoebox is missing', function(assert) {
    let service = this.owner.lookup('service:fastboot');

    let stub = sandbox.stub(document, 'querySelector').withArgs('#shoebox-foo');

    assert.strictEqual(service.get('shoebox').retrieve('foo'), undefined);

    sinon.assert.calledOnce(stub);
  });

  test('retrieve returns undefined if isFastBoot false and textContent is missing', function(assert) {
    let service = this.owner.lookup('service:fastboot');

    let stub = sandbox.stub(document, 'querySelector').withArgs('#shoebox-foo').returns({});

    assert.strictEqual(service.get('shoebox').retrieve('foo'), undefined);

    sinon.assert.calledOnce(stub);
  });

  test('retrieve returns value if isFastBoot false and textContent is present', function(assert) {
    let service = this.owner.lookup('service:fastboot');

    let stub = sandbox.stub(document, 'querySelector').withArgs('#shoebox-foo').returns({
      textContent: '{"foo":"bar"}'
    });

    assert.deepEqual(service.get('shoebox').retrieve('foo'), {
      foo: 'bar'
    });

    sinon.assert.calledOnce(stub);
  });

  test('retrieve returns undefined if isFastBoot true and shoebox is missing', function(assert) {
    this.owner.register('info:-fastboot', {}, { instantiate: false });
    let service = this.owner.factoryFor('service:fastboot').create({
      isFastBoot: true
    });

    assert.strictEqual(service.get('shoebox').retrieve('foo'), undefined);
  });

  test('retrieve returns undefined if isFastBoot true and key is missing', function(assert) {
    this.owner.register('info:-fastboot', { shoebox: {} }, { instantiate: false });
    let service = this.owner.factoryFor('service:fastboot').create({
      isFastBoot: true
    });

    assert.strictEqual(service.get('shoebox').retrieve('foo'), undefined);
  });

  test('retrieve returns value if isFastBoot true and key is present', function(assert) {
    this.owner.register('info:-fastboot', { shoebox: { foo: 'bar' } }, { instantiate: false });
    let service = this.owner.factoryFor('service:fastboot').create({
      isFastBoot: true
    });

    assert.strictEqual(service.get('shoebox').retrieve('foo'), 'bar');
  });
});
