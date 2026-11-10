#!/usr/bin/env node
/**
 * Deterministic DSA Hard bank validator for embedded question arrays in index.html.
 * Repeated explanation groups are a warning for content review, not proof of
 * semantic duplication. The script never deletes or rewrites questions.
 */
const fs = require("node:fs");
const vm = require("node:vm");

const htmlPath = process.argv[2] || "index.html";
const html = fs.readFileSync(htmlPath, "utf8");
const match = html.match(/const dsaPremiumHardQs\s*=\s*(\[[\s\S]*?\]);\s*\nconst /);
if (!match) {
  console.error("FAIL: Could not locate dsaPremiumHardQs array.");
  process.exit(1);
}
let questions;
try {
  questions = vm.runInNewContext("(" + match[1] + ")");
} catch (error) {
  console.error("FAIL: DSA Hard array is invalid:", error.message);
  process.exit(1);
}

const failures = [];
const warnings = [];
const normalize = value => String(value || "").normalize("NFKC").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim();

if (!Array.isArray(questions)) failures.push("Bank is not an array.");
if (questions.length !== 100) failures.push("Expected 100 questions; found " + questions.length + ".");

const ids = new Set();
const prompts = new Map();
const explanations = new Map();

questions.forEach((q, index) => {
  const label = "Question " + (index + 1);
  if (!q || typeof q !== "object") {
    failures.push(label + " is not an object.");
    return;
  }
  if (typeof q.id !== "string" || !q.id.trim()) {
    failures.push(label + " is missing a stable string id.");
  } else if (ids.has(q.id)) {
    failures.push(label + " duplicates ID " + q.id + ".");
  } else ids.add(q.id);

  if (typeof q.q !== "string" || !q.q.trim()) failures.push(label + " has empty question text.");
  if (!Array.isArray(q.o) || q.o.length !== 4 || q.o.some(x => typeof x !== "string" || !x.trim())) {
    failures.push(label + " must have four non-empty string options.");
  } else if (new Set(q.o.map(normalize)).size !== 4) {
    failures.push(label + " has duplicate options.");
  }
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) failures.push(label + " has invalid answer index.");
  if (typeof q.e !== "string" || !q.e.trim()) failures.push(label + " is missing its explanation.");
  if (q.level !== "Hard") failures.push(label + " is not labelled Hard.");

  const promptKey = normalize(q.q);
  if (promptKey && prompts.has(promptKey)) {
    failures.push(label + " duplicates normalized prompt at question " + prompts.get(promptKey) + ".");
  } else if (promptKey) prompts.set(promptKey, index + 1);

  const explanationKey = normalize(q.e);
  if (explanationKey) explanations.set(explanationKey, (explanations.get(explanationKey) || 0) + 1);
});

const repeatedExplanationGroups = [...explanations.values()].filter(count => count > 1).length;
if (repeatedExplanationGroups) warnings.push(
  repeatedExplanationGroups + " repeated explanation groups need concept-level human review."
);
if (ids.size !== 100) warnings.push(
  "Stable IDs are not implemented for all records; use persistent IDs, never array indexes."
);

console.log(JSON.stringify({
  bank: "DSA Hard",
  total: questions.length,
  uniqueIds: ids.size,
  uniqueNormalizedPrompts: prompts.size,
  repeatedExplanationGroups,
  failures,
  warnings
}, null, 2));

if (failures.length) process.exit(1);
if (warnings.length) process.exitCode = 2;
