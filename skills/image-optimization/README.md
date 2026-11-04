# image-optimization

> Part of the [`sandeshthapa07/skills`](../../README.md) collection. Version **1.0.0** (`metadata.version` in [`SKILL.md`](SKILL.md)).

An agent skill that fixes website image problems in any framework:

- **Stretched, squished or distorted images:** `object-fit`, `aspect-ratio`, `height: auto`, flex/grid stretching.
- **Layout shift (CLS):** `width`/`height`, reserved space, art-direction dimensions.
- **Wrong file sizes on different screens:** `srcset`, `sizes`, `<picture>`, DPR, blurry or oversized images.
- **Loading priority:** `loading="lazy"`/`eager`, `fetchpriority`, `decoding`, preload, a slow LCP.
- **Formats:** AVIF/WebP, SVG, GIF to video, image CDNs.
- **Alt text policy:** every image must have a filled, descriptive `alt`: `<img>`, framework components, Markdown, content backgrounds, inline SVG, `og:image:alt`. Decorative images get a filled alt + `aria-hidden="true"`. The audit scripts report missing, empty, generic ("image") and file-name alt text.
- **Social share images:** `og:image`, X/Twitter cards and link previews on Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram and Pinterest. Covers sizes per platform, tags, design safe zones, crawler and hosting rules, cache refresh, and generated OG images (`next/og`, Satori). Includes favicons.

Framework guides: plain HTML/CSS, React, Next.js, Remix / React Router, Gatsby, Vue, Nuxt, Angular, Svelte/SvelteKit, SolidJS, Astro, Qwik, Preact, WordPress, Shopify, Eleventy, Hugo, Jekyll, Docusaurus, and any image CDN (Cloudinary, Imgix, Cloudflare, Contentful, Sanity, ...).

The core idea: **give every image a role (LCP, above the fold, below the fold, fixed size, hidden, background), then apply the recipe for that role.**

## What is inside

```
image-optimization/
├── SKILL.md                      # Entry point: workflow, role table, golden rules, stretching table
├── references/
│   ├── 01-layout-stretching.md   # object-fit, aspect-ratio, flex/grid, CLS, EXIF orientation
│   ├── 02-responsive-sizing.md   # srcset, sizes (with worked examples), picture, art direction
│   ├── 03-loading-priority.md    # lazy/eager, fetchpriority, decoding, preload, LCP, carousels
│   ├── 04-formats-compression.md # AVIF/WebP, quality, SVG, GIF to video, caching
│   ├── 05-css-backgrounds.md     # image-set(), preloading backgrounds, <img> alternative
│   ├── 06-accessibility-seo.md   # alt text, decorative images, SEO
│   ├── 07-social-share-images.md # og:image / X cards: platform sizes, tags, design, hosting, testing, icons
│   ├── 08-social-meta-frameworks.md # social tags + generated OG images in every framework
│   └── frameworks/               # one file per framework (15 files)
├── checklists/
│   ├── audit-checklist.md        # step-by-step review
│   └── anti-patterns.md          # 24 common mistakes, before and after
├── examples/                     # copy-paste HTML: hero, card grid, art direction, carousel, background,
│                                 #   social-meta-tags.html, og-image-template.html (1200x630 design template)
├── scripts/
│   ├── audit-images.mjs          # static audit of a project (Node 18+, no dependencies)
│   ├── browser-audit.js          # paste into DevTools: LCP, stretching, oversized files, priorities
│   ├── image-size.mjs            # reads real image dimensions for width/height attributes
│   ├── check-social-meta.mjs     # checks og/twitter tags and the real share image, per platform
│   ├── make-social-images.mjs    # crops one image to every platform size + prints the tags (needs sharp)
│   ├── lib/image-header.mjs      # shared image-dimension parser
│   └── build-adapters.mjs        # regenerates adapters/ from adapters/core-rules.md
├── adapters/                     # for tools that do not read SKILL.md
│   ├── core-rules.md             # condensed rules (source for the files below)
│   ├── cursor/  copilot/  windsurf/  AGENTS.md  universal-prompt.md
└── evals/                        # broken test files + expectations
```

## Install

The skill uses the open **Agent Skills** format (a folder with a `SKILL.md`). Tools that support it load the skill automatically when a task matches its description. For tools that do not support it, use a file from `adapters/`.

### Option 1: `npx skills` (recommended)

The [`skills` CLI](https://github.com/vercel-labs/skills) installs the skill into one or more agents (Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, OpenCode, and others). Run it with `npx` (Node.js); nothing else to set up.

This skill lives in the [`sandeshthapa07/skills`](https://github.com/sandeshthapa07/skills) repository. `--skill image-optimization` picks it without the skill picker. Leave the flag out to search and choose from every skill in the repository (see the [main README](../../README.md#install)).

```bash
# Interactive: choose the agents, and project or global install
npx skills add sandeshthapa07/skills --skill image-optimization

# Into the current project, for specific agents
npx skills add sandeshthapa07/skills --skill image-optimization -a claude-code -a cursor

# Global (user level) instead of the current project
npx skills add sandeshthapa07/skills --skill image-optimization -g

# Every supported agent, no prompts
npx skills add sandeshthapa07/skills --skill image-optimization -a '*' -y

# Install straight from the folder URL (same result)
npx skills add https://github.com/sandeshthapa07/skills/tree/main/skills/image-optimization
```

Manage it later:

```bash
npx skills list                        # installed skills
npx skills update image-optimization   # get the latest version
npx skills remove image-optimization   # uninstall
```

- A project install puts the files in `.agents/skills/image-optimization/` and links them into each agent's folder (for example `.claude/skills/image-optimization`). Use `--copy` to copy the files instead of creating links.
- The command is `npx skills add`, not `npx skills install` (`experimental_install` only restores skills from a `skills-lock.json` file).
- Review a skill before you install it: skills run with your agent's permissions.

### Option 2: git clone

Clone the collection once, then copy (or link) this skill's folder into your agent's skills folder.

```bash
git clone https://github.com/sandeshthapa07/skills.git ~/sandeshthapa07-skills

# Claude Code, for all your projects
cp -r ~/sandeshthapa07-skills/skills/image-optimization ~/.claude/skills/

# Claude Code, for one project (run in the project folder)
mkdir -p .claude/skills && cp -r ~/sandeshthapa07-skills/skills/image-optimization .claude/skills/
```

To update, run `git pull` in `~/sandeshthapa07-skills` and copy the folder again. To skip the copy, use a symlink (`ln -s`) instead of `cp -r`.

### Option 3: manual copy per tool

> Skill folder locations can change between tool versions. If your tool does not pick up the skill, check its docs, or use the adapter in the last column.

| Tool | Install the skill | Fallback adapter |
|---|---|---|
| **Claude Code** | Personal: `~/.claude/skills/image-optimization/` (Windows: `%USERPROFILE%\.claude\skills\image-optimization\`). Project: `.claude/skills/image-optimization/` | |
| **Claude.ai / Claude Desktop** | ZIP the folder (`image-optimization/` at the root of the ZIP) and upload it in Settings, in the Skills section | `universal-prompt.md` in a Project |
| **Cursor** | Recent versions with Agent Skills: `.cursor/skills/image-optimization/` | `adapters/cursor/image-optimization.mdc` → `.cursor/rules/` |
| **GitHub Copilot** | Versions with Agent Skills: `.github/skills/image-optimization/` | `adapters/copilot/image-optimization.instructions.md` → `.github/instructions/` |
| **OpenAI Codex** | Versions with skills: `~/.codex/skills/image-optimization/` | Append `adapters/AGENTS.md` to your `AGENTS.md` |
| **Gemini CLI** | Versions with skills: see the Gemini CLI docs | Append `adapters/AGENTS.md` to `GEMINI.md` or `AGENTS.md` |
| **Windsurf** | | `adapters/windsurf/image-optimization.md` → `.windsurf/rules/` |
| **Cline / Roo / Kilo** | | `adapters/core-rules.md` → `.clinerules/` (or the tool's rules folder) |
| **Aider, Zed, Jules, others** | | Append `adapters/AGENTS.md` to `AGENTS.md` |
| **ChatGPT, Gemini, any chat LLM** | | Paste `adapters/universal-prompt.md` into custom instructions; upload `references/` as knowledge files |

### Create the ZIP for Claude.ai

```powershell
# Windows (PowerShell), from the skills/ folder of the repository (it contains image-optimization/)
Compress-Archive -Path image-optimization -DestinationPath image-optimization.zip
```

```bash
# macOS / Linux
zip -r image-optimization.zip image-optimization
```

## Use it

The skill starts automatically when you ask about image problems. Example prompts:

- "The product images are stretched on mobile. Fix them."
- "Lighthouse says the LCP image is lazy-loaded. Fix our hero."
- "Make the images in this Next.js page responsive and fast."
- "Audit all images in this project and fix the problems."
- "Why does this image look blurry on my iPhone?"
- "Our link shows no image on LinkedIn and WhatsApp. Fix the meta tags."
- "Make share images for Facebook, X and Pinterest from this photo."

In Claude Code you can also call it directly: `/image-optimization`.

## Scripts

All scripts need only Node.js 18 or newer. Only `make-social-images.mjs` has a dependency (`sharp`, installed in your project).

```bash
# 1. Static audit: finds lazy heroes, missing dimensions, srcset without sizes, stretch risks,
#    priority mistakes, CSS rules that squish images, background heroes, framework pitfalls
node scripts/audit-images.mjs ./src
node scripts/audit-images.mjs ./src --json            # for CI or other tools
node scripts/audit-images.mjs ./src --no-info --max-high=1

# 2. Real image dimensions, for correct width/height attributes (handles EXIF rotation)
node scripts/image-size.mjs public/images

# 3. Browser audit: open the page, reload, open DevTools > Console, paste scripts/browser-audit.js.
#    Run it at a mobile width and at a desktop width.

# 4. Social share preview check: reads the page like a crawler, downloads og:image,
#    checks size / ratio / file weight / status, and estimates the preview per platform
node scripts/check-social-meta.mjs https://acme.com/shoes/trail
node scripts/check-social-meta.mjs https://acme.com --ua=linkedin       # twitter, whatsapp, slack, discord, ...
node scripts/check-social-meta.mjs dist/index.html --public=dist        # built files, before deploying

# 5. Share images for every platform from one source (run inside your project after: npm i -D sharp)
node path/to/scripts/make-social-images.mjs photo.jpg --presets=og,twitter,pinterest --base-url=https://acme.com
node path/to/scripts/make-social-images.mjs logo.png --fit=contain --background=#111827   # logos: letterbox
```

`audit-images.mjs` exits with code 1 when it finds errors, so you can use it in CI:

```yaml
# GitHub Actions step
- run: node path/to/skills/image-optimization/scripts/audit-images.mjs src
```

The static audit uses heuristics: it cannot see the rendered layout. `browser-audit.js` checks the real page (the real LCP element, rendered vs. file aspect ratio, the file that the browser chose, priorities).

## Contribute

- Change the condensed rules only in `adapters/core-rules.md`, then run `node scripts/build-adapters.mjs`.
- Keep `SKILL.md` short. Put details in `references/`.
- Framework APIs change. When you update a framework file, write which version it applies to.
- Add a broken file and its expectations to `evals/` for each new rule. See `evals/README.md`.

## License

MIT. See [`LICENSE`](../../LICENSE).
