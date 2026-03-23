---
name: git
description: Create a PR from the current branch to main. Commits staged changes, pushes, and opens a GitHub PR.
---

# Create PR Workflow

Follow these steps in order:

1. **Check branch** — Run `git branch --show-current`. If on `main`, stop and tell the user to create a feature branch first.

2. **Stage & commit** — Run `git status` and `git diff` to see changes. Stage all relevant files (avoid secrets/.env). Create a commit with a clear message summarizing the changes. End the commit message with:
   ```
   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   ```

3. **Push** — Push the branch to origin with `-u` flag: `git push -u origin <branch-name>`

4. **Create PR** — Use `gh pr create` targeting `main`. Write a concise title (<70 chars) and body with:
   - `## Summary` — 1-3 bullet points of what changed
   - `## Test plan` — How to verify the changes
   - Footer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

5. **Report** — Show the PR URL to the user.
