/* eslint-env node */
const recast = require('recast');
const { readFileSync, writeFileSync } = require('fs');
const { join, dirname } = require('path')
const tmp = require('tmp');
const mkdirp = require('mkdirp');

module.exports = {
  description: '',
  normalizeEntityName() {
    // no-op
  },

  filesPath() {
    return this._filesPath;
  },

  _targetsFile(project) {
    let configPath = 'config';

    if (project.pkg['ember-addon'] && project.pkg['ember-addon']['configPath']) {
      configPath = project.pkg['ember-addon']['configPath'];
    }

    return join(configPath, 'targets.js');
  },

  install(options) {
    this._filesPath = tmp.dirSync().name;

    const targetsFile = this._targetsFile(options.project);

    const targetsAst = recast.parse(readFileSync(targetsFile));

    recast.visit(targetsAst, {
      visitAssignmentExpression (path) {
        let node = path.node;

        if (node.left.object.name === 'module' && node.left.property.name === 'exports') {
          let nodeProperty = node.right.properties.find(property => property.key.name === 'node');

          if(!nodeProperty) {
            let builders = recast.types.builders;
            nodeProperty = builders.property(
              'init',
              builders.identifier('node'),
              builders.literal('current')
            );
            node.right.properties.push(nodeProperty);
          }
        }

        this.traverse(path);
      }
    });

    let newFile = join(this._filesPath, targetsFile);
    mkdirp.sync(dirname(newFile));
    writeFileSync(newFile, recast.print(targetsAst, { tabWidth: 2, quote: 'single' }).code);

    return this._super.install.apply(this, arguments);
  }
};
