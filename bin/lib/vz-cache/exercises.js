"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { generateSimulation } = require("./sim");

const SLOT = "%% cache-exercises %%";
const GENERATE_FLAGS = {
  seed: "--seed",
  blocks: "--blocks",
  accesses: "--accesses",
  hits: "--hits",
  minHits: "--min-hits",
  maxHits: "--max-hits",
  conflicts: "--conflicts",
  initial: "--initial",
  membits: "--membits",
  blockbits: "--blockbits",
  ways: "--ways"
};

function fail(message) {
  throw new Error(`cache exercises: ${message}`);
}

function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be a mapping`);
  }
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function load(filename) {
  try {
    return yaml.load(fs.readFileSync(filename, "utf8"));
  } catch (error) {
    fail(`cannot read ${filename}: ${error.message}`);
  }
}

function readText(filename) {
  try {
    return fs.readFileSync(filename, "utf8");
  } catch (error) {
    fail(`cannot read ${filename}: ${error.message}`);
  }
}

function relativeInput(root, value, label) {
  text(value, label);
  if (path.isAbsolute(value)) fail(`${label} must be relative to the input YAML`);
  return path.resolve(root, value);
}

function physicalDirectory(directory) {
  const missing = [];
  let existing = directory;
  while (!fs.existsSync(existing)) {
    missing.push(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(fs.realpathSync(existing), ...missing.reverse());
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function markdownPath(value) {
  return value.split(path.sep).map(part => encodeURIComponent(part)).join("/");
}


function family(filename) {
  const source = readText(filename);
  const header = source.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!header) fail(`${filename}: family template must start with YAML metadata containing intro`);
  let metadata;
  try {
    metadata = mapping(yaml.load(header[1]), `${filename} metadata`);
  } catch (error) {
    fail(`${filename}: invalid template metadata: ${error.message}`);
  }
  return { intro: text(metadata.intro, `${filename} metadata.intro`), body: source.slice(header[0].length) };
}

function interpolate(body, values, label) {
  const rendered = body.replace(/\$\{([^}]*)\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) fail(`${label}: unknown placeholder ${match}`);
    return values[name];
  });
  if (/\$\{/.test(rendered)) fail(`${label}: unresolved placeholder in rendered Markdown`);
  return rendered.trim();
}

function rebaseDestination(destination, from, to) {
  const angle = destination.startsWith("<") && destination.endsWith(">");
  const target = angle ? destination.slice(1, -1) : destination;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target)) return destination;
  const split = target.search(/[?#]/);
  const filename = split < 0 ? target : target.slice(0, split);
  const suffix = split < 0 ? "" : target.slice(split);
  let decoded;
  try {
    decoded = decodeURIComponent(filename);
  } catch (error) {
    fail(`invalid relative Markdown URL ${destination}: ${error.message}`);
  }
  const rebased = markdownPath(path.relative(to, path.resolve(from, decoded))) + suffix;
  return angle ? `<${rebased}>` : rebased;
}

function rebaseMarkdown(body, from, to) {
  if (from === to) return body;
  return body
    .replace(/(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)\n]+)(?=[\s)])/g,
      (match, opener, destination) => opener + rebaseDestination(destination, from, to))
    .replace(/^(\s*\[[^\]\n]+\]:\s*)(<[^>\n]+>|\S+)/gm,
      (match, opener, destination) => opener + rebaseDestination(destination, from, to))
    .replace(/(\b(?:src|href)=["'])([^"']+)(["'])/g,
      (match, opener, destination, closer) => opener + rebaseDestination(destination, from, to) + closer);
}


function generatedEntry(id, raw, manifestRoot) {
  const label = `${id}.generate`;
  const options = Object.assign(Object.create(null), { seed: id }, mapping(raw, label));
  for (const [name, value] of Object.entries(options)) {
    if (!Object.prototype.hasOwnProperty.call(GENERATE_FLAGS, name)) {
      fail(`${label}: unknown option ${name}`);
    }
    if (name === "seed") {
      if (!(typeof value === "string" && value.trim()) && !Number.isSafeInteger(value)) {
        fail(`${label}.seed must be a non-empty string or a safe integer`);
      }
    } else if ((name === "accesses" || name === "initial") && Array.isArray(value)) {
      continue;
    } else if (!Number.isSafeInteger(value)) {
      fail(`${label}.${name} must be an integer`);
    }
  }
  // Validate with the real generator before replacing either output. The asset
  // command receives the same seed, so configuration and trace stay identical.
  try {
    generateSimulation(options);
  } catch (error) {
    fail(`${label}: ${error.message || error}`);
  }
  const vars = { prefix: shellQuote(path.join(manifestRoot, id, "assets", id)) };
  const flags = [];
  for (const [name, flag] of Object.entries(GENERATE_FLAGS)) {
    if (options[name] === undefined) continue;
    const structured = name === "initial" || (name === "accesses" && Array.isArray(options[name]));
    const flagName = name === "accesses" && structured ? "--trace" : flag;
    vars[name] = structured ? shellQuote(JSON.stringify(options[name]))
      : name === "seed" ? shellQuote(String(options[name])) : options[name];
    flags.push(structured || name === "seed" ? `${flagName}={${name}}` : `${flagName} {${name}}`);
  }
  return {
    vars,
    steps: [`vzpac cache-new sim ${flags.join(" ")} -c -x {prefix}`]
  };
}

function writeIfChanged(filename, content) {
  if (fs.existsSync(filename) && fs.readFileSync(filename, "utf8") === content) return;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
}

function generate(input, output, manifest) {
  const inputPath = path.resolve(input);
  const root = path.dirname(inputPath);
  const doc = mapping(load(inputPath), inputPath);
  const templatePath = relativeInput(root, doc.template, "template");
  const chapterPath = relativeInput(root, doc.chapter, "chapter");
  const basePath = relativeInput(root, doc.base_assets, "base_assets");
  const outputPath = path.resolve(text(output, "output (-o)"));
  const manifestPath = path.resolve(text(manifest, "manifest (--manifest)"));
  const inputs = [inputPath, templatePath, chapterPath, basePath];
  if (outputPath === manifestPath || inputs.includes(outputPath) || inputs.includes(manifestPath)) {
    fail("output and manifest must be distinct files, and must not overwrite any input");
  }
  // Markdown readers resolve '..' through filesystem symlinks, not lexically.
  const outputRoot = physicalDirectory(path.dirname(outputPath));
  const manifestRoot = path.dirname(manifestPath);
  const tag = text(doc.tag, "tag");
  if (!/^[A-Za-z0-9_-]+$/.test(tag)) fail("tag must be a slide identifier (letters, digits, underscores or hyphens)");
  const template = family(templatePath);
  const chapter = readText(chapterPath);
  const slotPattern = /^%% cache-exercises %%[ \t]*\r?$/gm;
  const slots = chapter.match(slotPattern) || [];
  if (slots.length !== 1) fail(`${chapterPath}: expected exactly one ${SLOT} slot on its own line; found ${slots.length}`);
  const base = mapping(load(basePath), basePath);
  const combined = Object.create(null);
  const occupied = new Set();
  const baseIds = new Set();
  for (const [key, entry] of Object.entries(base)) {
    if (path.isAbsolute(key)) fail(`${basePath}: asset entry ${key} must be a relative directory`);
    const directory = path.resolve(path.dirname(basePath), key);
    occupied.add(directory);
    baseIds.add(path.basename(directory));
    combined[path.relative(manifestRoot, directory).split(path.sep).join("/") || "."] = entry;
  }
  if (!Array.isArray(doc.sections) || !doc.sections.length) fail("sections must be a non-empty array");
  const ids = new Set();
  const sections = doc.sections.map((rawSection, sectionIndex) => {
    const section = mapping(rawSection, `sections[${sectionIndex}]`);
    const title = text(section.title, `sections[${sectionIndex}].title`);
    if (/[\r\n]/.test(title)) fail(`sections[${sectionIndex}].title must be a single line`);
    if (!Array.isArray(section.exercises) || !section.exercises.length) fail(`sections[${sectionIndex}].exercises must be a non-empty array`);
    const exercises = section.exercises.map((rawExercise, exerciseIndex) => {
      const exercise = mapping(rawExercise, `sections[${sectionIndex}].exercises[${exerciseIndex}]`);
      const id = text(exercise.id, "exercise.id");
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) fail(`exercise.id ${id} must contain only letters, digits, underscores or hyphens and start with a letter or digit`);
      if (ids.has(id)) fail(`duplicate exercise id ${id}`);
      if (baseIds.has(id) || occupied.has(path.join(manifestRoot, id))) fail(`exercise id ${id} collides with a base manifest asset directory`);
      ids.add(id);
      if (exercise.params !== undefined) fail(`${id}: params is no longer supported; use generate with blocks and ways`);
      if (exercise.generate === undefined) fail(`${id}: provide generate`);
      const intro = exercise.intro === undefined ? template.intro : text(exercise.intro, `${id}.intro`);
      combined[id] = generatedEntry(id, exercise.generate, manifestRoot);
      return interpolate(template.body, {
        id, intro, tag,
        assets: markdownPath(path.relative(outputRoot, path.join(manifestRoot, id, "assets", id))),
        source: markdownPath(path.relative(outputRoot, inputPath))
      }, `${templatePath} (${id})`);
    });
    return `## ${title}\n\n${exercises.join("\n\n")}`;
  });
  // Rebase only static source content, never the already output-relative family.
  const rebased = rebaseMarkdown(chapter, path.dirname(chapterPath), outputRoot);
  const markdown = rebased.replace(slotPattern, () => sections.join("\n\n"));
  const assets = yaml.dump(combined, { lineWidth: -1, noRefs: true });
  writeIfChanged(outputPath, markdown);
  writeIfChanged(manifestPath, assets);
}

function register(prog) {
  prog.command("cache exercises", "Generate a cache exercise chapter and combined asset manifest")
    .argument("<yml>", "Cache instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
