#!/usr/bin/env node
/**
 * build-adapters.mjs - generate the tool-specific adapter files from adapters/core-rules.md.
 * Run after you change core-rules.md:  node scripts/build-adapters.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(root, 'adapters', 'core-rules.md'), 'utf8').trim();
const generated = '<!-- Generated from adapters/core-rules.md by scripts/build-adapters.mjs. Edit core-rules.md, not this file. -->';
const description = 'Fix web image problems: stretched or distorted images, layout shift (CLS), wrong srcset/sizes, blurry or oversized images, lazy loading, fetchpriority, preload and slow LCP, in any framework.';
const globs = '**/*.{html,htm,jsx,tsx,js,ts,vue,svelte,astro,mdx,php,liquid,njk,css,scss}';

const outputs = {
  // Cursor: .cursor/rules/image-optimization.mdc ("Agent Requested": loaded when the description matches)
  'cursor/image-optimization.mdc': `---\ndescription: ${JSON.stringify(description)}\nglobs:\nalwaysApply: false\n---\n${generated}\n\n${core}\n`,

  // GitHub Copilot: .github/instructions/image-optimization.instructions.md
  'copilot/image-optimization.instructions.md': `---\napplyTo: ${JSON.stringify(globs)}\ndescription: ${JSON.stringify(description)}\n---\n${generated}\n\n${core}\n`,

  // Windsurf: .windsurf/rules/image-optimization.md
  'windsurf/image-optimization.md': `---\ntrigger: model_decision\ndescription: ${JSON.stringify(description)}\n---\n${generated}\n\n${core}\n`,

  // AGENTS.md (Codex, Jules, Aider, Zed, many others): append to the project's AGENTS.md
  'AGENTS.md': `${generated}\n\n<!-- Append this section to your project's AGENTS.md. -->\n\n${core.replace(/^# /m, '## ').replace(/^## (?!Image optimization rules)/gm, '### ')}\n`,

  // Chat LLMs (ChatGPT custom GPT / project, Gemini Gem, Claude Project, any chat)
  'universal-prompt.md': `${generated}\n\n<!--\nHow to use:\n- ChatGPT (custom GPT or project), Gemini (Gem), Claude (project), or any chat LLM:\n  paste everything below into the instructions / custom instructions field.\n- For more detail, also upload the files in references/ as knowledge files.\n-->\n\nYou are an expert in web image performance and layout. Follow these rules when you write or review code that contains images.\n\n${core}\n`,
};

for (const [rel, content] of Object.entries(outputs)) {
  const file = join(root, 'adapters', rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`wrote adapters/${rel}`);
}
