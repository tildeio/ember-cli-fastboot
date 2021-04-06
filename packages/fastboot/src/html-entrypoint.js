'use strict';

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function htmlEntrypoint(appName, distPath, htmlPath, config) {
  let html = fs.readFileSync(path.join(distPath, htmlPath), 'utf8');
  let dom = new JSDOM(html);
  let scripts = [];

  let rootURL = getRootURL(appName, config);

  for (let element of dom.window.document.querySelectorAll('script,fastboot-script')) {
    let src = extractSrc(element);
    if (!extractIgnore(element)) {
      let relativeSrc = urlWithin(src, rootURL);
      if (relativeSrc) {
        scripts.push(path.join(distPath, relativeSrc));
      }
    }
    if (element.tagName === 'FASTBOOT-SCRIPT') {
      removeWithWhitespaceTrim(element);
    }
  }

  return { html: dom.serialize(), scripts };
}

function extractSrc(element) {
  if (element.hasAttribute('data-fastboot-src')) {
    let src = element.getAttribute('data-fastboot-src');
    element.removeAttribute('data-fastboot-src');
    return src;
  } else {
    return element.getAttribute('src');
  }
}

function extractIgnore(element) {
  if (element.hasAttribute('data-fastboot-ignore')) {
    element.removeAttribute('data-fastboot-ignore');
    return true;
  }
  return false;
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

// removes an element, and if that element was on a line by itself with nothing
// but whitespace, removes the whole line. The extra whitespace would otherwise
// be harmless but ugly.
function removeWithWhitespaceTrim(element) {
  let prev = element.previousSibling;
  let next = element.nextSibling;
  if (prev && next && prev.nodeType == prev.TEXT_NODE && next.nodeType === next.TEXT_NODE) {
    let prevMatch = prev.textContent.match(/\n\s*$/);
    let nextMatch = next.textContent.match(/^(\s*\n)/);
    if (prevMatch && nextMatch) {
      prev.textContent = prev.textContent.slice(0, prevMatch.index + 1);
      next.textContent = next.textContent.slice(nextMatch[0].length);
    }
  }
  element.remove();
}

module.exports = htmlEntrypoint;
