/* globals najax */
import Ember from 'ember';

const { get } = Ember;

var nodeAjax = function(options) {
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

export default {
  name: 'ajax-service',

  initialize: function(application) {
    application.register('ajax:node', nodeAjax, { instantiate: false });
    application.inject('adapter', '_ajaxRequest', 'ajax:node');
    application.inject('adapter', 'fastboot', 'service:fastboot');
  }
};
