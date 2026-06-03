"use strict";

let _ = require("lodash");

let DEFAULT_RANGES = {
  membits: _.range(10, 21),
  blockbits: _.range(2, 11),
  blockindexbits: _.range(0, 6),
  cacheways: _.range(0, 3)
};

let hashSeed = seed => {
  let s = _.isUndefined(seed) ? `${Date.now()}` : `${seed}`;
  let h = 2166136261;
  _.forEach(s, c => {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  });
  return h >>> 0;
};

let seededRandom = seed => {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

let assertPowerOfTwo = (name, value) => {
  if (value < 1 || value & (value - 1)) {
    throw `${name} must be a positive power of two`;
  }
};

let log2Exact = (name, value) => {
  assertPowerOfTwo(name, value);
  return Math.log2(value);
};

let optionValue = (opts, key) => {
  return _.isUndefined(opts[key]) ? undefined : parseInt(opts[key]);
};

let normalizeConstraints = opts => {
  let c = {};
  _.forEach(["membits", "blockbits", "indexbits", "cachesizebits"], key => {
    let value = optionValue(opts, key);
    if (!_.isUndefined(value)) c[key] = value;
  });
  if (!_.isUndefined(opts.ways)) c.cacheways = log2Exact("ways", opts.ways);
  if (!_.isUndefined(c.indexbits)) {
    c.blockindexbits = c.indexbits;
    delete c.indexbits;
  }
  return c;
};

let valuesFor = (key, constraints) => {
  if (!_.isUndefined(constraints[key])) return [constraints[key]];
  return DEFAULT_RANGES[key];
};

let getMemSize = ({ membits, cacheways, blockbits, cachesizebits }) => {
  let blockindexbits = cachesizebits - blockbits - cacheways;
  let tagbits = membits - blockindexbits - blockbits;
  if (blockindexbits + blockbits + tagbits !== membits) {
    throw `inconsistency between data (${blockindexbits} + ${blockbits} + ${tagbits} != ${membits})`;
  }
  return {
    tagbits,
    blockbits,
    membits,
    blockindexbits,
    numberOfBlocks: Math.pow(2, blockindexbits) * Math.pow(2, cacheways)
  };
};

let enrichConfig = config => {
  let size = getMemSize(config);
  let associativity = Math.pow(2, config.cacheways);
  let numberOfSets = Math.pow(2, size.blockindexbits);
  return _.merge({}, config, size, {
    associativity,
    numberOfSets,
    memoryBytes: Math.pow(2, config.membits),
    blockBytes: Math.pow(2, config.blockbits),
    cacheBytes: Math.pow(2, config.cachesizebits)
  });
};

let isValid = config => {
  if (config.blockbits <= 0) return false;
  if (config.blockindexbits < 0) return false;
  if (config.cacheways < 0) return false;
  if (config.membits <= config.blockbits + config.blockindexbits) return false;
  if (config.cachesizebits !== config.blockbits + config.blockindexbits + config.cacheways) return false;
  return true;
};

let enumerateConfigs = constraints => {
  let configs = [];
  _.forEach(valuesFor("membits", constraints), membits => {
    _.forEach(valuesFor("blockbits", constraints), blockbits => {
      _.forEach(valuesFor("blockindexbits", constraints), blockindexbits => {
        _.forEach(valuesFor("cacheways", constraints), cacheways => {
          let cachesizebits = blockbits + blockindexbits + cacheways;
          let config = { membits, blockbits, blockindexbits, cacheways, cachesizebits };
          if (!_.isUndefined(constraints.cachesizebits) &&
              constraints.cachesizebits !== cachesizebits) {
            return;
          }
          if (isValid(config)) configs.push(enrichConfig(config));
        });
      });
    });
  });
  return configs;
};

let generateConfig = opts => {
  opts = opts || {};
  let constraints = normalizeConstraints(opts);
  let candidates = enumerateConfigs(constraints);
  if (_.isEmpty(candidates)) {
    throw "no valid cache configuration matches the requested constraints";
  }
  let seed = _.isUndefined(opts.seed) ? `${Date.now()}` : `${opts.seed}`;
  let random = seededRandom(seed);
  let config = candidates[Math.floor(random() * candidates.length)];
  return _.merge({ seed }, config);
};

module.exports = {
  DEFAULT_RANGES,
  enumerateConfigs,
  enrichConfig,
  generateConfig,
  getMemSize,
  isValid,
  log2Exact,
  normalizeConstraints,
  seededRandom
};
