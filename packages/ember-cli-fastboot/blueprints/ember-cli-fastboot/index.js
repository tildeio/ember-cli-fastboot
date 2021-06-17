'use strict';

/* eslint-env node */
const path = require('path');
const recast = require('recast');
const { readFileSync, writeFileSync, existsSync } = require('fs');

module.exports = {
  description: '',
  normalizeEntityName() {
    // no-op
  },

  afterInstall() {
    this.updateBabelTargets();
    this.removeTitleFromIndexHtml();
  },

  updateBabelTargets() {
    let targetsFile = './config/targets.js'

    if(this.project.isEmberCLIAddon()) {
      targetsFile = './tests/dummy/config/targets.js';
    }

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

    writeFileSync(targetsFile, recast.print(targetsAst, { tabWidth: 2, quote: 'single' }).code);
  },

  removeTitleFromIndexHtml() {
    let isEmberPageTitlePresent = 'ember-page-title' in this.project.dependencies();

    if (isEmberPageTitlePresent) {
      let indexHtmlPath = this.project.isEmberCLIAddon() ?
        path.join(this.project.root, 'tests', 'dummy', 'app', 'index.html') :
        path.join(this.project.root, 'app', 'index.html');

      if (existsSync(indexHtmlPath)) {
        const contents = readFileSync(
          indexHtmlPath,
          {
            encoding: 'utf8'
          }
        );

        const titleMatches = contents.match(/<title>\s*(.*)\s*<\/title>/i);
        const title = titleMatches && titleMatches[1] || "Example Title";
        if (titleMatches) {
          writeFileSync(
            indexHtmlPath,
            contents.replace(/\s*<title>\s*.*\s*<\/title>/gi, ''),
            {
              encoding: 'utf8'
            }
          );
        }
        this.ui.writeWarnLine(`<title> has been removed from index.html due to ember-page-title being present, please add {{page-title "${title}"}} to application.hbs`);
      }
    }
  }
};
