'use strict';

module.exports = function(environment) {
  var ENV = {
    rootURL: '/',
    locationType: 'auto',
    environment: environment,
    modulePrefix: 'fastboot-location-config',
    fastboot: {
      fastbootHeaders: false,
      hostAllowList: [/localhost:\d+/],
      redirectCode: 302,
    }
  };

  return ENV;
};
