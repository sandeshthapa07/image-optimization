# Evals

Test cases that check whether an agent with this skill fixes image problems correctly.

```
evals/
├── evals.json   # prompts + expectations for each case
└── cases/       # broken files (HTML, Next.js, Vue, Angular, Astro)
```

## Run a case by hand

1. Copy the skill folder to the tool you want to test (see the main README).
2. Copy `evals/cases/` to a scratch project, so the originals stay broken.
3. Give the agent the `prompt` of a case.
4. Check the result against the case's `expectations`.
5. Run the static check on the fixed file. It must report **0 errors**:

   ```bash
   node scripts/audit-images.mjs path/to/fixed-file
   ```

## Static check on the broken cases

```bash
node scripts/audit-images.mjs evals/cases
```

Every case should report problems. If a case reports nothing, either the audit script has a bug or the case is no longer broken.

## Compare with and without the skill

Run the same prompts in a session without the skill. The difference shows what the skill adds. A good result with the skill:

- fixes every expectation,
- does not add `fetchpriority="high"` to more than one image,
- does not guess dimensions (it reads them or asks),
- explains crops caused by `object-fit: cover`.

## Add a case

1. Add a broken file to `cases/`. Mark each bug with a comment.
2. Add an entry to `evals.json` with `prompt`, `files`, `expected_output` and `expectations`.
3. Check that `node scripts/audit-images.mjs evals/cases/<file>` finds the bugs that it can find statically.
