'use strict';

module.exports = {
  name: require('./package').name,

  updateFastBootManifest: function(manifest) {
    manifest.vendorFiles.unshift('example-addon/foo.js');
    manifest.appFiles.push('example-addon/bar.js');

    return manifest;
  },

  fastbootConfigTree() {
    return {
      'example-addon': {
        foo: 'bar',
      },
    };
  },
};
