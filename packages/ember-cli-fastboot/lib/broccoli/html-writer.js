'use strict';

const Filter = require('broccoli-persistent-filter');
const { JSDOM } = require('jsdom');

module.exports = class BasePageWriter extends Filter {
  constructor(inputNodes, { annotation, fastbootConfig, appName, manifest, outputPaths }) {
    super(inputNodes, {
      annotation,
      extensions: ['html'],
      targetExtension: 'html',
    });
    this._manifest = manifest;
    this._rootURL = getRootURL(fastbootConfig, appName);
    this._appJsPath = outputPaths.app.js;
    this._expectedFiles = expectedFiles(outputPaths);
  }

  getDestFilePath() {
    let filteredRelativePath = super.getDestFilePath(...arguments);

    return filteredRelativePath === this._manifest.htmlFile ? filteredRelativePath : null;
  }

  processString(content) {
    let dom = new JSDOM(content);
    let scriptTags = dom.window.document.querySelectorAll('script');

    // In fastboot-config.js the paths are transformed with stripLeadingSlash
    // do we need to concat rootURL here?
    let rootURL = this._rootURL;

    ignoreUnexpectedScripts(scriptTags, this._expectedFiles);

    let fastbootScripts = this._findFastbootScriptToInsert(scriptTags);

    let appJsTag = findAppJsTag(scriptTags, this._appJsPath, rootURL);

    insertFastbootScriptsBeforeAppJsTags(fastbootScripts, appJsTag);

    return dom.serialize();
  }

  _findFastbootScriptToInsert(scriptTags) {
    let rootURL = this._rootURL;
    let scriptSrcs = [];
    for (let element of scriptTags) {
      scriptSrcs.push(urlWithin(element.getAttribute('src'), rootURL));
    }

    return this._manifest.vendorFiles
      .concat(this._manifest.appFiles)
      .map(src => urlWithin(src, rootURL))
      .filter(src => !scriptSrcs.includes(src));
  }
};

function expectedFiles(outputPaths) {
  function stripLeadingSlash(filePath) {
    return filePath.replace(/^\//, '');
  }

  let appFilePath = stripLeadingSlash(outputPaths.app.js);
  let appFastbootFilePath = appFilePath.replace(/\.js$/, '') + '-fastboot.js';
  let vendorFilePath = stripLeadingSlash(outputPaths.vendor.js);
  return [appFilePath, appFastbootFilePath, vendorFilePath];
}

function ignoreUnexpectedScripts(scriptTags, expectedFiles) {
  for (let element of scriptTags) {
    if (!expectedFiles.includes(urlWithin(element.getAttribute('src')))) {
      element.setAttribute('data-fastboot-ignore', '');
    }
  }
}

function getRootURL(appName, config) {
  let rootURL = (config[appName] && config[appName].rootURL) || '/';
  if (!rootURL.endsWith('/')) {
    rootURL = rootURL + '/';
  }
  return rootURL;
}

function urlWithin(candidate, root) {
  let candidateURL = new URL(candidate, 'http://_the_current_origin_');
  let rootURL = new URL(root, 'http://_the_current_origin_');
  if (candidateURL.href.startsWith(rootURL.href)) {
    return candidateURL.href.slice(rootURL.href.length);
  }
}

function findAppJsTag(scriptTags, appJsPath, rootURL) {
  appJsPath = urlWithin(appJsPath, rootURL);
  for (let e of scriptTags) {
    if (urlWithin(e.getAttribute('src'), rootURL) === appJsPath) {
      return e;
    }
  }
}

function insertFastbootScriptsBeforeAppJsTags(fastbootScripts, appJsTag) {
  let range = new NodeRange(appJsTag);

  for (let src of fastbootScripts) {
    range.insertAsScriptTag(src);
  }
}

class NodeRange {
  constructor(initial) {
    this.start = initial.ownerDocument.createTextNode('');
    initial.parentElement.insertBefore(this.start, initial);
    this.end = initial;
  }

  insertAsScriptTag(src) {
    let newTag = this.end.ownerDocument.createElement('fastboot-script');
    newTag.setAttribute('src', src);
    this.insertNode(newTag);
  }

  insertNode(node) {
    this.end.parentElement.insertBefore(node, this.end);
  }
}
