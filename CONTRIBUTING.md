# Contributing

## Add a skill

1. Create `skills/<skill-name>/SKILL.md`. The folder name must be the same as `name` (lowercase letters, numbers and hyphens):

   ```markdown
   ---
   name: my-skill
   description: What the skill does and when to use it. The agent reads this to decide when to load the skill, so include the words that users will type.
   license: MIT
   metadata:
     version: "1.0.0"
   ---

   # My Skill

   Instructions for the agent.
   ```

2. Put everything that the skill needs (references, scripts, examples) inside its folder. The CLI installs each skill folder separately.
3. Add the skill to the [Reference](README.md#reference) list in `README.md`, with its version:

   ```markdown
   - **[my-skill](./skills/my-skill/)** `v1.0.0` — What the skill does, in one or two sentences.
   ```

4. If the skill has quick one-line fixes, add them to [`cheatsheet.md`](cheatsheet.md) or [`performance.md`](performance.md).
5. Check that the CLI finds the skill:

   ```bash
   npx skills add . --list
   ```

### Rules that keep search and Select All working

- Do not put a `SKILL.md` at the repository root. If the root has one, the CLI installs only that skill and ignores `skills/`.
- Do not put a `SKILL.md` in other folders at the root (for example `assets/`). The CLI also looks for skills one level below the root.
- Do not add a `.claude-plugin/marketplace.json` or `plugin.json` that groups the skills. With groups, the CLI shows collapsible groups instead of the search box (skills CLI 1.7.6).

## Versions

Each skill has its own version, in [semantic versioning](https://semver.org) format, in the `metadata.version` field of its `SKILL.md`. This field is the source of truth. The same number is in two other places:

- the skill's line in the [Reference](README.md#reference) list in `README.md`,
- the first lines of the skill's own `README.md`.

When you change a skill, increase its version in all three places:

| Change | Example | Increase |
|---|---|---|
| Breaking change: renamed or removed files, scripts or options; the skill now behaves very differently | `1.4.2` → `2.0.0` | major |
| New rules, references, scripts or framework support | `1.4.2` → `1.5.0` | minor |
| Fixes, typos, clearer wording | `1.4.2` → `1.4.3` | patch |

- Keep the value in quotes (`"1.0.0"`): the Agent Skills format requires string values in `metadata`.
- `npx skills update` does not read this number. It compares the content of the skill folder, so users get every pushed change, even when you forget to increase the version.

## Repository layout

```
skills/
├── README.md                  # skill list and install guide
├── cheatsheet.md              # problem → solution, one line each
├── performance.md             # performance problem → solution, one line each
├── CONTRIBUTING.md            # this file
├── LICENSE
├── assets/
│   └── banner.svg             # README banner (1200x630)
└── skills/
    └── image-optimization/    # one folder per skill
        ├── SKILL.md
        ├── README.md
        └── references/  scripts/  examples/  checklists/  adapters/  evals/
```
