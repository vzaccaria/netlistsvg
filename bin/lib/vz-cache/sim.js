"use strict";

let _ = require("lodash");
let { enrichConfig, isValid, log2Exact, seededRandom } = require("./config");

let optionValue = (opts, key) => {
  return _.isUndefined(opts[key]) ? undefined : parseInt(opts[key]);
};

let randInt = (random, min, max) => {
  return min + Math.floor(random() * (max - min + 1));
};

let choose = (random, values) => values[randInt(random, 0, values.length - 1)];

let shuffle = (random, values) => {
  let result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    let j = randInt(random, 0, i);
    let tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
};

let bits = (value, width) => {
  if (width === 0) return "";
  return value.toString(2).padStart(width, "0");
};

let normalizeSeed = opts => {
  return _.isUndefined(opts.seed) ? `${Date.now()}` : `${opts.seed}`;
};

let makeFourBlockConfig = opts => {
  opts = opts || {};
  let seed = normalizeSeed(opts);
  let random = seededRandom(`${seed}:config`);
  let ways = _.isUndefined(opts.ways) ? choose(random, [1, 2, 4]) : optionValue(opts, "ways");
  let cacheways = log2Exact("ways", ways);
  if (cacheways > 2) {
    throw "ways must be 1, 2, or 4 for a 4-block cache";
  }

  let blockindexbits = 2 - cacheways;
  let blockbits = _.isUndefined(opts.blockbits)
    ? randInt(random, 2, 10)
    : optionValue(opts, "blockbits");
  let minMemBlockBits = Math.max(3, blockindexbits + 1);
  let minMembits = blockbits + minMemBlockBits;
  let membits = _.isUndefined(opts.membits)
    ? randInt(random, Math.max(10, minMembits), 20)
    : optionValue(opts, "membits");
  let config = {
    seed,
    membits,
    blockbits,
    blockindexbits,
    cacheways,
    cachesizebits: blockbits + 2
  };

  if (membits < minMembits) {
    throw `membits must be at least ${minMembits} for a useful 4-block simulation`;
  }
  if (!isValid(config)) {
    throw "invalid 4-block cache configuration";
  }
  config = enrichConfig(config);
  if (config.numberOfBlocks !== 4) {
    throw "simulation cache must contain exactly 4 blocks";
  }
  return config;
};

let normalizeHitTarget = (opts, random, accesses) => {
  let exact = optionValue(opts, "hits");
  let minHits = _.isUndefined(exact)
    ? (_.isUndefined(opts.minHits) ? 0 : optionValue(opts, "minHits"))
    : exact;
  let maxHits = _.isUndefined(exact)
    ? (_.isUndefined(opts.maxHits) ? accesses - 1 : optionValue(opts, "maxHits"))
    : exact;

  if (accesses < 1) throw "accesses must be at least 1";
  if (minHits < 0 || maxHits < 0) throw "hit constraints must be non-negative";
  if (minHits > maxHits) throw "min-hits cannot be greater than max-hits";
  if (maxHits > accesses - 1) {
    throw "a cold empty cache cannot hit on the first access";
  }
  return randInt(random, minHits, maxHits);
};

let buildPlan = (random, accesses, hits) => {
  let misses = accesses - hits;
  let rest = _.flatten([
    _.map(_.range(0, hits), () => "hit"),
    _.map(_.range(0, misses - 1), () => "miss")
  ]);
  return ["miss"].concat(shuffle(random, rest));
};

let makeState = config => {
  return _.map(_.range(0, config.numberOfSets), () => []);
};

let residentLines = state => _.flatten(state);

let refFromBlock = (config, random, blockNumber) => {
  let set = config.numberOfSets === 1 ? 0 : blockNumber % config.numberOfSets;
  let tag = Math.floor(blockNumber / config.numberOfSets);
  let offset = randInt(random, 0, Math.pow(2, config.blockbits) - 1);
  let tagBits = bits(tag, config.tagbits);
  let indexBits = bits(set, config.blockindexbits);
  let offsetBits = bits(offset, config.blockbits);
  return {
    tag,
    set,
    offset,
    blockNumber,
    tagBits,
    indexBits,
    offsetBits,
    address: tagBits + indexBits + offsetBits,
    groupedAddress: _.filter([tagBits, indexBits, offsetBits], x => x !== "").join(" ")
  };
};

let isHit = (state, ref) => {
  return !_.isUndefined(_.find(state[ref.set], line => line.tag === ref.tag));
};

let chooseMissRef = (config, state, random) => {
  let maxBlock = Math.pow(2, config.membits - config.blockbits) - 1;
  for (let i = 0; i < 1000; i++) {
    let ref = refFromBlock(config, random, randInt(random, 0, maxBlock));
    if (!isHit(state, ref)) return ref;
  }
  throw "could not find a miss candidate";
};

let chooseHitRef = (config, state, random) => {
  let lines = residentLines(state);
  if (_.isEmpty(lines)) throw "cannot generate a hit before any cache line is resident";
  let line = choose(random, lines);
  return refFromBlock(config, random, line.blockNumber);
};

let applyAccess = (config, state, ref, step) => {
  let set = state[ref.set];
  let line = _.find(set, l => l.tag === ref.tag);
  if (!_.isUndefined(line)) {
    line.last = step;
    return "hit";
  }

  let newLine = {
    tag: ref.tag,
    set: ref.set,
    blockNumber: ref.blockNumber,
    last: step
  };
  if (set.length < config.associativity) {
    set.push(newLine);
  } else {
    let victim = _.minBy(set, l => l.last);
    let victimIndex = _.findIndex(set, l => l === victim);
    set[victimIndex] = newLine;
  }
  return "miss";
};

let generateSimulation = opts => {
  opts = opts || {};
  let seed = normalizeSeed(opts);
  let random = seededRandom(`${seed}:trace`);
  let config = makeFourBlockConfig(opts);
  let accesses = _.isUndefined(opts.accesses) ? 6 : optionValue(opts, "accesses");
  let hits = normalizeHitTarget(opts, random, accesses);
  let plan = buildPlan(random, accesses, hits);
  let state = makeState(config);
  let trace = _.map(plan, (desired, i) => {
    let ref = desired === "hit"
      ? chooseHitRef(config, state, random)
      : chooseMissRef(config, state, random);
    let result = applyAccess(config, state, ref, i + 1);
    if (result !== desired) {
      throw `internal trace generation error: expected ${desired}, got ${result}`;
    }
    return _.merge({}, ref, {
      step: i + 1,
      expected: result,
      action: result === "hit" ? `leggo mem[${ref.blockNumber}]` : `carico mem[${ref.blockNumber}]`
    });
  });

  return {
    seed,
    config,
    constraints: {
      accesses,
      hits,
      minHits: _.isUndefined(opts.minHits) ? undefined : optionValue(opts, "minHits"),
      maxHits: _.isUndefined(opts.maxHits) ? undefined : optionValue(opts, "maxHits")
    },
    hitCount: hits,
    missCount: accesses - hits,
    trace
  };
};

module.exports = {
  buildPlan,
  generateSimulation,
  makeFourBlockConfig
};
