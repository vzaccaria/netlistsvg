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
    return value.split(path.sep).map(part => encodeURIComponent(part)
      .replace(/[!'()*]/g, character => "%" + character.charCodeAt(0).toString(16).toUpperCase())).join("/");
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

  function interpolate(body, values, label, trim = true) {
    const rendered = body.replace(/\$\{([^}]*)\}/g, (match, name, offset) => {
      const value = typeof values === "function" ? values(name) :
        Object.prototype.hasOwnProperty.call(values, name) ? values[name] : undefined;
      if (value === undefined) fail(`${label}: unknown placeholder ${match}`);
      const before = body.slice(body.lastIndexOf("\n", offset - 1) + 1, offset);
      const prefix = /^[ \t]*(?:>[ \t]*)*$/.test(before) ? before : "";
      return String(value).replace(/\n/g, "\n" + prefix);
    });
    if (/\$\{/.test(rendered)) fail(`${label}: unresolved placeholder in rendered Markdown`);
    return trim ? rendered.trim() : rendered;
  }

  function rebaseDestination(destination, from, to) {
    const angle = destination.startsWith("<") && destination.endsWith(">");
    const target = angle ? destination.slice(1, -1) : destination;
    if (target.includes("${") || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target)) return destination;
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
    from = physicalDirectory(from);
    to = physicalDirectory(to);
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
    const inline = doc.mode === "inline";
    if (doc.mode !== undefined && !inline) fail("mode must be inline when specified");
    const chapterPath = relativeInput(root, doc.chapter, "chapter");
    const basePath = doc.base_assets === undefined ? undefined : relativeInput(root, doc.base_assets, "base_assets");
    const outputPath = path.resolve(text(output, "output (-o)"));
    const manifestPath = path.resolve(text(manifest, "manifest (--manifest)"));
    const inputs = [inputPath, chapterPath, basePath].filter(Boolean);
    const physicalFile = filename => fs.existsSync(filename) ? fs.realpathSync(filename) :
      path.join(physicalDirectory(path.dirname(filename)), path.basename(filename));
    const outputRoot = physicalDirectory(path.dirname(outputPath));
    const manifestRoot = physicalDirectory(path.dirname(manifestPath));
    const tag = text(doc.tag, "tag");
    if (!/^[A-Za-z0-9_-]+$/.test(tag)) fail("tag must be a slide identifier (letters, digits, underscores or hyphens)");
    const templates = new Map();
    function getTemplate(value) {
      if (value === null || value === undefined) return undefined;
      const filename = relativeInput(root, value, "template");
      if (!templates.has(filename)) {
        const template = family(filename);
        template.body = rebaseMarkdown(template.body, path.dirname(filename), outputRoot);
        template.intro = rebaseMarkdown(template.intro, path.dirname(filename), outputRoot);
        templates.set(filename, template);
        inputs.push(filename);
      }
      return Object.assign({ filename }, templates.get(filename));
    }
    const defaultTemplate = getTemplate(doc.template);
    if (!inline && !defaultTemplate) fail("template must be a non-empty string");
    const chapter = readText(chapterPath);
    const slotPattern = new RegExp(`^%% ${name}-exercises %%[ \\t]*\\r?$`, "gm");
    if (!inline) {
      const slots = chapter.match(slotPattern) || [];
      if (slots.length !== 1) fail(`${chapterPath}: expected exactly one %% ${name}-exercises %% slot on its own line; found ${slots.length}`);
    }
    const base = basePath === undefined ? {} : mapping(load(basePath), basePath);
    const combined = Object.create(null);
    const occupied = new Set();
    const baseIds = new Set();
    for (const [key, entry] of Object.entries(base)) {
      if (path.isAbsolute(key)) fail(`${basePath}: asset entry ${key} must be a relative directory`);
      const directory = physicalFile(path.resolve(path.dirname(basePath), key));
      occupied.add(directory);
      baseIds.add(path.basename(directory));
      combined[path.relative(manifestRoot, directory).split(path.sep).join("/") || "."] = entry;
    }
    if (!Array.isArray(doc.sections) || !doc.sections.length) fail("sections must be a non-empty array");
    const records = new Map();
    const sections = doc.sections.map((rawSection, sectionIndex) => {
      const section = mapping(rawSection, `sections[${sectionIndex}]`);
      const title = text(section.title, `sections[${sectionIndex}].title`);
      if (/[\r\n]/.test(title)) fail(`sections[${sectionIndex}].title must be a single line`);
      const level = section.level === undefined ? 2 : section.level;
      if (!Number.isInteger(level) || level < 1 || level > 6) fail(`sections[${sectionIndex}].level must be an integer between 1 and 6`);
      const sectionTemplate = section.template === undefined ? defaultTemplate : getTemplate(section.template);
      if (!Array.isArray(section.exercises) || !section.exercises.length) fail(`sections[${sectionIndex}].exercises must be a non-empty array`);
      const ids = section.exercises.map((rawExercise, exerciseIndex) => {
        const exercise = mapping(rawExercise, `sections[${sectionIndex}].exercises[${exerciseIndex}]`);
        const id = text(exercise.id, "exercise.id");
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) fail(`exercise.id ${id} must contain only letters, digits, underscores or hyphens and start with a letter or digit`);
        if (records.has(id)) fail(`duplicate exercise id ${id}`);
        if (baseIds.has(id) || occupied.has(physicalFile(path.join(manifestRoot, id)))) fail(`exercise id ${id} collides with a base manifest asset directory`);
        if (exercise.params !== undefined) fail(`${id}: params is no longer supported; use generate`);
        if (exercise.generate === undefined) fail(`${id}: provide generate`);
        const template = exercise.template === undefined ? sectionTemplate : getTemplate(exercise.template);
        if (!inline && !template) fail(`${id}: template is required outside inline mode`);
        const generated = generatedEntry(id, exercise.generate, manifestRoot);
        combined[id] = generated.entry;
        const values = Object.assign({}, generated.values, {
          id, tag,
          assets: markdownPath(path.relative(outputRoot, path.join(manifestRoot, id, "assets", id))),
          source: markdownPath(path.relative(outputRoot, physicalFile(inputPath)))
        });
        const intro = exercise.intro === undefined ? template && template.intro : text(exercise.intro, `${id}.intro`);
        const commentary = exercise.commentary === undefined ? "" : rebaseMarkdown(
          text(exercise.commentary, `${id}.commentary`), root, outputRoot);
        records.set(id, { id, template, values, intro, commentary });
        return id;
      });
      return { title, level, ids };
    });
    const physicalInputs = inputs.map(physicalFile);
    if (physicalFile(outputPath) === physicalFile(manifestPath) ||
        physicalInputs.includes(physicalFile(outputPath)) || physicalInputs.includes(physicalFile(manifestPath))) {
      fail("output and manifest must be distinct files, and must not overwrite any input");
    }
    const referenced = new Set();
    const resolving = new Set();
    const source = markdownPath(path.relative(outputRoot, physicalFile(inputPath)));
    function namespaced(key) {
      if (key === "source") return source;
      const dot = key.indexOf(".");
      if (dot < 0) return undefined;
      const id = key.slice(0, dot);
      const field = key.slice(dot + 1);
      const record = records.get(id);
      if (!record) return undefined;
      referenced.add(id);
      if (field === "exercise") return render(record);
      return local(record, field);
    }
    function local(record, key) {
      if (Object.prototype.hasOwnProperty.call(record.values, key)) return record.values[key];
      if (key !== "intro" && key !== "commentary") return undefined;
      const pending = `${record.id}.${key}`;
      if (resolving.has(pending)) fail(`cyclic placeholder ${pending}`);
      resolving.add(pending);
      const raw = record[key];
      const value = raw === undefined ? undefined : interpolate(raw,
        field => local(record, field) === undefined ? namespaced(field) : local(record, field), `${record.id} ${key}`);
      resolving.delete(pending);
      if (value !== undefined) record.values[key] = value;
      return value;
    }
    function render(record) {
      if (!record.template) return undefined;
      if (record.values.exercise !== undefined) return record.values.exercise;
      const pending = `${record.id}.exercise`;
      if (resolving.has(pending)) fail(`cyclic placeholder ${pending}`);
      resolving.add(pending);
      record.values.exercise = interpolate(record.template.body,
        key => local(record, key) === undefined ? namespaced(key) : local(record, key), record.template.filename);
      resolving.delete(pending);
      return record.values.exercise;
    }
    const rebased = rebaseMarkdown(chapter, path.dirname(chapterPath), outputRoot);
    let markdown;
    if (inline) {
      markdown = interpolate(rebased, namespaced, chapterPath, false);
      for (const id of records.keys()) if (!referenced.has(id)) fail(`unreferenced exercise id ${id}`);
    } else {
      const renderedSections = sections.map(section =>
        `${"#".repeat(section.level)} ${section.title}\n\n${section.ids.map(id => render(records.get(id))).join("\n\n")}`);
      markdown = rebased.replace(slotPattern, () => renderedSections.join("\n\n"));
    }
    const assets = yaml.dump(combined, { lineWidth: -1, noRefs: true });
    writeIfChanged(outputPath, markdown);
    writeIfChanged(manifestPath, assets);
  }


  return { generate, fail, mapping, shellQuote };
};
