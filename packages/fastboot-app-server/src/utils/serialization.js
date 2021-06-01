'use strict';

/**
 * The purpose of this module is to provide a serialization layer for passing arguments to a new Worker instance
 * This allows us to completely separate the cluster worker from the cluster primary
 */

function circularReplacer() {
  const seen = new WeakSet();

  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }

      seen.add(value);
    }

    return value;
  }
}

function serialize(object) {
  let data = encodeURIComponent(JSON.stringify(object, circularReplacer()));
  let buff = new Buffer.from(data);
  return buff.toString('base64');
}

function deserialize(string) {
  let buff = new Buffer.from(string, 'base64');
  return JSON.parse(decodeURIComponent(buff.toString('ascii')));
}

module.exports = {
  serialize,
  deserialize
};
