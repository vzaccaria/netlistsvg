"use strict";

let { enrichConfig, isValid, log2Exact, seededRandom } = require("./config");

let integerOption = (opts, key, fallback) => {
  let value = opts[key];
  if (value === undefined) return fallback;
  if (typeof value === "string" && /^[+-]?\d+$/.test(value)) value = Number(value);
  if (!Number.isSafeInteger(value)) throw `${key} must be a safe integer`;
  return value;
};
let randInt = (random, min, max) => min + Math.floor(random() * (max - min + 1));
let choose = (random, values) => values[randInt(random, 0, values.length - 1)];
let shuffle = (random, values) => {
  let result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    let j = randInt(random, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
let bits = (value, width) => width === 0 ? "" : value.toString(2).padStart(width, "0");
let normalizeSeed = opts => opts.seed === undefined ? `${Date.now()}` : `${opts.seed}`;

let makeSimulationConfig = opts => {
  let seed = normalizeSeed(opts);
  let random = seededRandom(`${seed}:config`);
  let blocks = integerOption(opts, "blocks", 4);
  if (blocks !== 2 && blocks !== 4) throw "blocks must be 2 or 4";
  let ways = opts.ways === undefined ? choose(random, blocks === 2 ? [1, 2] : [1, 2, 4]) : integerOption(opts, "ways");
  if (ways < 1 || blocks % ways !== 0) throw "ways must divide blocks";
  let cacheways = log2Exact("ways", ways);
  let blockindexbits = Math.log2(blocks) - cacheways;
  let blockbits = opts.blockbits === undefined ? randInt(random, 2, 10) : integerOption(opts, "blockbits");
  if (blockbits < 0 || blockbits > 51) throw "blockbits must be between 0 and 51";
  let minMembits = Math.min(52, blockbits + Math.max(3, blockindexbits + 1));
  let membits = opts.membits === undefined
    ? randInt(random, Math.max(10, minMembits), Math.max(20, minMembits))
    : integerOption(opts, "membits");
  let config = { seed, membits, blockbits, blockindexbits, cacheways, cachesizebits: blockbits + Math.log2(blocks) };
  if (membits > 52 || config.cachesizebits > membits || !isValid(config)) throw "invalid cache configuration: require cache <= memory, with index and tag bits within 52 address bits";
  return enrichConfig(config);
};

let makeInitial = (config, supplied) => {
  if (supplied === undefined) return Array.from({ length: config.numberOfBlocks }, () => ({ valid: false }));
  if (!Array.isArray(supplied) || supplied.length !== config.numberOfBlocks) throw "initial must contain exactly blocks entries";
  let seen = new Set();
  return supplied.map((line, slot) => {
    if (!line || typeof line.valid !== "boolean" || typeof line.tag !== "string" || !/^[01]+$/.test(line.tag) || !Number.isSafeInteger(line.data)) {
      throw "initial entries require boolean valid, binary string tag, and safe integer data";
    }
    if (line.valid) {
      if (line.tag.length !== config.tagbits) throw "valid initial tags must have exactly tagbits bits";
      let key = `${Math.floor(slot / config.associativity)}:${line.tag}`;
      if (seen.has(key)) throw "initial cannot contain duplicate valid tags in a set";
      seen.add(key);
    }
    return { valid: line.valid, tag: line.tag, data: line.data };
  });
};

let reference = (config, address) => {
  if (typeof address !== "string" || !/^[01 ]+$/.test(address)) throw "accesses must contain quoted binary addresses (spaces allowed)";
  let compact = address.replace(/ /g, "");
  if (compact.length !== config.membits) throw `address must contain exactly ${config.membits} bits`;
  let tagBits = compact.slice(0, config.tagbits);
  let indexBits = compact.slice(config.tagbits, config.tagbits + config.blockindexbits);
  let offsetBits = compact.slice(config.tagbits + config.blockindexbits);
  let tag = parseInt(tagBits, 2);
  let set = indexBits === "" ? 0 : parseInt(indexBits, 2);
  return {
    tag, set, offset: offsetBits === "" ? 0 : parseInt(offsetBits, 2),
    blockNumber: tag * config.numberOfSets + set,
    tagBits, indexBits, offsetBits, address,
    groupedAddress: [tagBits, indexBits, offsetBits].filter(part => part !== "").join(" ")
  };
};
let generatedReference = (config, tag, set, offset) => reference(config,
  bits(tag, config.tagbits) + bits(set, config.blockindexbits) + bits(offset, config.blockbits));
let setSlots = (config, set) => Array.from({ length: config.associativity }, (_, way) => set * config.associativity + way);
let snapshot = (state, accessed) => state.map((line, slot) => {
  let copy = { valid: line.valid };
  if (line.tag !== undefined) copy.tag = line.tag;
  if (line.data !== undefined) copy.data = line.data;
  if (accessed !== undefined) copy.highlight = slot === accessed;
  return copy;
});
let applyAccess = (config, state, ref, step) => {
  let slots = setSlots(config, ref.set);
  let slot = slots.find(index => state[index].valid && state[index].tag === ref.tagBits);
  let type = slot === undefined ? "miss" : "hit";
  let conflict = false;
  if (slot === undefined) {
    slot = slots.find(index => !state[index].valid);
    if (slot === undefined) {
      conflict = true;
      slot = slots.reduce((best, index) => state[index].last < state[best].last ? index : best, slots[0]);
    }
    state[slot] = { valid: true, tag: ref.tagBits, data: ref.blockNumber, last: step };
  } else state[slot].last = step;
  return { type, slot, conflict };
};

let buildPlan = (random, accesses, hits, populated = false) => {
  let misses = accesses - hits;
  let rest = Array(hits).fill("hit").concat(Array(misses - (populated ? 0 : 1)).fill("miss"));
  return populated ? shuffle(random, rest) : ["miss"].concat(shuffle(random, rest));
};

// Select outside a finite exclusion set without sampling retries or enumerating memory.
let availableTag = (random, count, excluded) => {
  if (excluded.size >= count) return undefined;
  let tag = randInt(random, 0, count - 1);
  while (excluded.has(tag)) tag = (tag + 1) % count;
  return tag;
};
let generationBudget = (opts, config, initial, accesses, random) => {
  let conflicts = integerOption(opts, "conflicts", 0);
  if (conflicts < 0) throw "conflicts must be non-negative";
  let tagCount = Math.pow(2, config.tagbits);
  let occupancy = Array.from({ length: config.numberOfSets }, (_, set) => setSlots(config, set).filter(slot => initial[slot].valid).length);
  let populated = occupancy.some(count => count > 0);
  let minMisses = populated ? 0 : 1;
  let maxMisses = tagCount > config.associativity ? accesses : occupancy.reduce((sum, count) => sum + tagCount - count, 0);
  let targetSet;
  if (conflicts > 0) {
    if (tagCount <= config.associativity) throw "conflicts are impossible when all tags fit in each set";
    let fullest = Math.max(...occupancy);
    targetSet = choose(random, occupancy.map((count, set) => count === fullest ? set : undefined).filter(set => set !== undefined));
    minMisses = Math.max(minMisses, config.associativity - fullest + conflicts);
  }
  let exact = integerOption(opts, "hits", undefined);
  let minHits = exact === undefined ? integerOption(opts, "minHits", 0) : exact;
  let maxHits = exact === undefined ? integerOption(opts, "maxHits", accesses - (populated ? 0 : 1)) : exact;
  if (minHits < 0 || maxHits < 0 || minHits > maxHits) throw "hit constraints must be non-negative with minHits <= maxHits";
  if (maxHits > accesses - (populated ? 0 : 1)) throw "hit target exceeds accesses or requires a first-access hit in a cold cache";
  let feasibleMin = Math.max(minHits, accesses - maxMisses);
  let feasibleMax = Math.min(maxHits, accesses - minMisses);
  if (feasibleMin > feasibleMax) throw "hit and conflict constraints cannot be satisfied by this cache and initial state";
  return { hits: randInt(random, feasibleMin, feasibleMax), conflicts, targetSet, tagCount };
};

let generateSimulation = (opts = {}) => {
  let explicit = Array.isArray(opts.accesses);
  if (explicit) {
    if (opts.accesses.length === 0) throw "accesses array must not be empty";
    if (opts.membits === undefined || opts.blockbits === undefined) throw "explicit accesses require membits and blockbits";
    for (let key of ["hits", "minHits", "maxHits", "conflicts"]) {
      if (opts[key] !== undefined) throw `${key} is only supported for generated accesses`;
    }
  }
  let seed = normalizeSeed(opts);
  let random = seededRandom(`${seed}:trace`);
  let config = makeSimulationConfig(Object.assign({}, opts, { seed }));
  let initial = makeInitial(config, opts.initial);
  let state = initial.map(line => Object.assign({}, line, { last: 0 }));
  let accesses = explicit ? opts.accesses.length : integerOption(opts, "accesses", 6);
  if (accesses < 1) throw "accesses must be at least 1";
  let budget = explicit ? undefined : generationBudget(opts, config, initial, accesses, random);
  let plan = explicit ? opts.accesses.map(address => reference(config, address)) : buildPlan(random, accesses, budget.hits, initial.some(line => line.valid));
  let actions = [{ type: "", state: snapshot(state), description: "Situazione iniziale" }];
  let trace = [];
  let usedTags = new Set();
  let usedMissTags = new Set();
  let usedSets = new Set();
  let usedOffsets = new Set();
  let lastOffsets = new Map();
  let conflictCount = 0;
  let hitCount = 0;
  let remainingMisses = accesses - (budget ? budget.hits : 0);
  for (let i = 0; i < plan.length; i++) {
    let ref;
    if (explicit) ref = plan[i];
    else if (plan[i] === "hit") {
      let slots = state.map((line, slot) => line.valid ? slot : undefined).filter(slot => slot !== undefined);
      let unvisited = slots.filter(slot => !usedSets.has(Math.floor(slot / config.associativity)));
      let slot = choose(random, unvisited.length ? unvisited : slots);
      let set = Math.floor(slot / config.associativity);
      let tag = parseInt(state[slot].tag, 2);
      let block = tag * config.numberOfSets + set;
      let offsetCount = Math.pow(2, config.blockbits);
      let previous = lastOffsets.has(block) ? lastOffsets.get(block) : 0;
      let offset = offsetCount > 1 ? (previous + randInt(random, 1, offsetCount - 1)) % offsetCount : 0;
      ref = generatedReference(config, tag, set, offset);
    } else {
      let candidates = Array.from({ length: config.numberOfSets }, (_, set) => set).filter(set =>
        setSlots(config, set).filter(slot => state[slot].valid).length < budget.tagCount);
      let required = budget.conflicts - conflictCount;
      let set;
      if (required > 0) {
        let vacancies = setSlots(config, budget.targetSet).filter(slot => !state[slot].valid).length;
        if (remainingMisses <= vacancies + required) set = budget.targetSet;
      }
      if (set === undefined) {
        let unvisited = candidates.filter(candidate => !usedSets.has(candidate));
        set = choose(random, unvisited.length ? unvisited : candidates);
      }
      let resident = new Set(setSlots(config, set).filter(slot => state[slot].valid).map(slot => parseInt(state[slot].tag, 2)));
      let fresh = new Set([...resident, ...usedMissTags]);
      let tag = availableTag(random, budget.tagCount, fresh);
      if (tag === undefined) tag = availableTag(random, budget.tagCount, resident);
      ref = generatedReference(config, tag, set, randInt(random, 0, Math.pow(2, config.blockbits) - 1));
      remainingMisses--;
    }
    let result = applyAccess(config, state, ref, i + 1);
    if (result.type === "hit") hitCount++;
    else usedMissTags.add(ref.tag);
    if (result.conflict) conflictCount++;
    usedTags.add(ref.tag);
    usedSets.add(ref.set);
    usedOffsets.add(ref.offset);
    lastOffsets.set(ref.blockNumber, ref.offset);
    let row = Object.assign({}, ref, {
      step: i + 1, expected: result.type,
      action: `${result.type === "hit" ? "leggo" : "carico"} mem[${ref.blockNumber}]`
    });
    trace.push(row);
    actions.push({
      type: result.type, state: snapshot(state, result.slot), access: ref.address,
      description: `${row.action} in cache${config.blockindexbits === 0 ? "" : `[${ref.set}]`}`
    });
  }
  return {
    seed, config, initial,
    constraints: {
      accesses, hits: budget ? budget.hits : undefined,
      minHits: opts.minHits === undefined ? undefined : integerOption(opts, "minHits"),
      maxHits: opts.maxHits === undefined ? undefined : integerOption(opts, "maxHits"),
      conflicts: budget ? budget.conflicts : undefined
    },
    hitCount, missCount: accesses - hitCount, conflictCount,
    tagCount: usedTags.size, setCount: usedSets.size, offsetCount: usedOffsets.size,
    trace, results: { actions, cache: snapshot(state) }
  };
};

module.exports = { buildPlan, generateSimulation, makeSimulationConfig };
