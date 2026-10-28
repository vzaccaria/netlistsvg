"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

module.exports = function collection(name) {
  function fail(message) {
    throw new Error(`${name} exercises: ${message}`);
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
      .replace(/^(\s*\[(?!\^)[^\]\n]+\]:\s*)(<[^>\n]+>|\S+)/gm,
        (match, opener, destination) => opener + rebaseDestination(destination, from, to))
      .replace(/(\b(?:src|href)=["'])([^"']+)(["'])/g,
        (match, opener, destination, closer) => opener + rebaseDestination(destination, from, to) + closer);
  }


  function writeIfChanged(filename, content) {
    if (fs.existsSync(filename) && fs.readFileSync(filename, "utf8") === content) return;
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  }

  function generate(input, output, manifest, generatedEntry) {
    const inputPath = path.resolve(input);
    const root = path.dirname(inputPath);
    const doc = mapping(load(inputPath), inputPath);
    const templatePath = relativeInput(root, doc.template, "template");
    const chapterPath = relativeInput(root, doc.chapter, "chapter");
    const basePath = doc.base_assets === undefined ? undefined : relativeInput(root, doc.base_assets, "base_assets");
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
    const slotPattern = new RegExp(`^%% ${name}-exercises %%[ \\t]*\\r?$`, "gm");
    const slots = chapter.match(slotPattern) || [];
    if (slots.length !== 1) fail(`${chapterPath}: expected exactly one %% ${name}-exercises %% slot on its own line; found ${slots.length}`);
    const base = basePath === undefined ? {} : mapping(load(basePath), basePath);
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
      const level = section.level === undefined ? 2 : section.level;
      if (!Number.isInteger(level) || level < 1 || level > 6) fail(`sections[${sectionIndex}].level must be an integer between 1 and 6`);
      if (!Array.isArray(section.exercises) || !section.exercises.length) fail(`sections[${sectionIndex}].exercises must be a non-empty array`);
      const exercises = section.exercises.map((rawExercise, exerciseIndex) => {
        const exercise = mapping(rawExercise, `sections[${sectionIndex}].exercises[${exerciseIndex}]`);
        const id = text(exercise.id, "exercise.id");
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) fail(`exercise.id ${id} must contain only letters, digits, underscores or hyphens and start with a letter or digit`);
        if (ids.has(id)) fail(`duplicate exercise id ${id}`);
        if (baseIds.has(id) || occupied.has(path.join(manifestRoot, id))) fail(`exercise id ${id} collides with a base manifest asset directory`);
        ids.add(id);
        if (exercise.params !== undefined) fail(`${id}: params is no longer supported; use generate`);
        if (exercise.generate === undefined) fail(`${id}: provide generate`);
        const intro = exercise.intro === undefined ? template.intro : text(exercise.intro, `${id}.intro`);
        const generated = generatedEntry(id, exercise.generate, manifestRoot);
        combined[id] = generated.entry;
        const values = Object.assign({}, generated.values, {
          id, tag,
          assets: markdownPath(path.relative(outputRoot, path.join(manifestRoot, id, "assets", id))),
          source: markdownPath(path.relative(outputRoot, inputPath))
        });
        values.intro = interpolate(intro, values, `${templatePath} (${id}) intro`);
        values.commentary = exercise.commentary === undefined ? "" : interpolate(
          text(exercise.commentary, `${id}.commentary`), values, `${templatePath} (${id}) commentary`);
        return interpolate(template.body, values, `${templatePath} (${id})`);
      });
      return `${"#".repeat(level)} ${title}\n\n${exercises.join("\n\n")}`;
    });
    // Rebase only static source content, never the already output-relative family.
    const rebased = rebaseMarkdown(chapter, path.dirname(chapterPath), outputRoot);
    const markdown = rebased.replace(slotPattern, () => sections.join("\n\n"));
    const assets = yaml.dump(combined, { lineWidth: -1, noRefs: true });
    writeIfChanged(outputPath, markdown);
    writeIfChanged(manifestPath, assets);
  }


  return { generate, fail, mapping, shellQuote };
};
