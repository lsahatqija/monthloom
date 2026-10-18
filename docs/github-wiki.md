# GitHub wiki and automated patch notes

Monthloom publishes its project documentation and one patch-note page for every push to
`main`. Documentation remains versioned with the application; the GitHub wiki is the readable
publication target.

## One-time GitHub setup

1. Open the repository on GitHub and select **Settings → General → Features → Wikis**.
2. Enable **Wikis** if it is disabled.
3. Open the **Wiki** tab, create the initial page named `Home`, and save it. GitHub does not create
   the wiki Git repository until this first page exists.
4. Push or merge a change to `main`. After the `Tests` workflow completes, confirm that its
   `Publish wiki and patch notes` job updated the wiki.

No personal access token or repository secret is required. The short-lived `GITHUB_TOKEN` checks
out and updates the wiki belonging to the same repository. The workflow grants `contents: write`
only to its publishing job; an organization policy that forces tokens to read-only must allow this
permission.

## How publication works

The `Tests` workflow retains the push event's exact before/after commit range. Once checks finish
for a push to `main`, whether they pass or fail, the publishing job:

- copies the curated pages in `wiki/`;
- copies maintained technical guides from `docs/` and architecture decisions from `docs/adr/`;
- groups commit subjects into features, improvements, fixes, documentation, tests, and
  maintenance;
- records changed areas, files, insertions, deletions, links to commits, the complete comparison,
  and the successful workflow run;
- regenerates the `Patch Notes` index and pushes the result to the wiki repository.

The generated filename includes the UTC push timestamp and commit SHA. Re-running the same
workflow updates the same page instead of creating a duplicate. Publishing jobs are serialized so
near-simultaneous pushes cannot overwrite one another.

## Writing useful patch notes

Patch-note prose is derived from commit subjects, so concise outcome-focused subjects produce the
best result. Conventional Commit prefixes improve grouping, for example:

```text
feat(finance): add recurring transaction projections
fix(auth): preserve the requested page after login
docs: explain off-server backup recovery
```

Squash merging is recommended because the pull request title becomes the readable change summary.
If merge commits are used, the generator lists their non-merge commits instead.

## Troubleshooting

- **Wiki checkout fails:** create the first `Home` page in the GitHub UI and rerun the failed job.
- **Push is denied:** enable read/write workflow permissions and check that organization policy
  does not force the token to read-only.
- **A note is missing:** patch notes publish after the test job finishes. Rerun the complete
  `Tests` workflow and inspect the publishing job's annotations.
- **The wording is too technical:** edit the commit or squash-merge title before merging. Generated
  pages can also be edited in the wiki, though re-running that push will regenerate its page.
