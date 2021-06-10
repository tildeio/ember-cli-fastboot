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
    this._fastbootConfig = fastbootConfig;
    this._appJsPath = outputPaths.app.js;
    this._expectedFiles = expectedFiles(outputPaths);
  }

  getDestFilePath() {
    let filteredRelativePath = super.getDestFilePath(...arguments);

    return filteredRelativePath === this._manifest.htmlFile ? filteredRelativePath : null;
  }

  processString(content) {
    let dom = new JSDOM(content);
    this._handleConfig(dom);
    this._handleScripts(dom);
    return dom.serialize();
  }

  _handleConfig(dom) {
    function findFistConfigMeta(dom) {
      let metaTags = dom.window.document.querySelectorAll('meta');
      for (let element of metaTags) {
        let name = element.getAttribute('name');
        if (name && name.endsWith('/config/environment')) {
          return element;
        }
      }
    }
    let firstConfigMeta;
    if (firstConfigMeta) {
      firstConfigMeta = findFistConfigMeta(dom);
    } else {
      firstConfigMeta = dom.window.document.createTextNode('\n');
      dom.window.document.head.appendChild(firstConfigMeta);
    }
    let nodeRange = new NodeRange(firstConfigMeta);
    for (let [name, options] of Object.entries(this._fastbootConfig)) {
      nodeRange.insertJsonAsMetaTag(`${name}/config/fastboot-environment`, options);
    }
  }

  _handleScripts(dom) {
    let scriptTags = dom.window.document.querySelectorAll('script');

    this._ignoreUnexpectedScripts(scriptTags);

    let fastbootScripts = this._findFastbootScriptToInsert(scriptTags);
    let appJsTag = findAppJsTag(scriptTags, this._appJsPath, this._rootURL);
    if (!appJsTag) {
      throw new Error('ember-cli-fastboot cannot find own app script tag');
    }

    insertFastbootScriptsBeforeAppJsTags(fastbootScripts, appJsTag);
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

  _ignoreUnexpectedScripts(scriptTags) {
    let expectedFiles = this._expectedFiles;
    let rootURL = this._rootURL;
    for (let element of scriptTags) {
      if (!expectedFiles.includes(urlWithin(element.getAttribute('src'), rootURL))) {
        element.setAttribute('data-fastboot-ignore', '');
      }
    }
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

function getRootURL(appName, config) {
  let rootURL = (config[appName] && config[appName].rootURL) || '/';
  if (!rootURL.endsWith('/')) {
    rootURL = rootURL + '/';
  }
  return rootURL;
}

function urlWithin(candidate, root) {
  // this is a null or relative path
  if (!candidate || !candidate.startsWith('/')) {
    return candidate;
  }
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
    this.insertNewLine();
  }

  insertJsonAsMetaTag(name, content) {
    let newTag = this.end.ownerDocument.createElement('meta');
    newTag.setAttribute('name', name);
    newTag.setAttribute('content', encodeURIComponent(JSON.stringify(content)));
    this.insertNode(newTag);
    this.insertNewLine();
  }

  insertNewLine() {
    this.insertNode(this.end.ownerDocument.createTextNode('\n'));
  }

  insertNode(node) {
    this.end.parentElement.insertBefore(node, this.end);
  }
}
