---
name: review
description: Review code changes, run the code-reviewer agent, and merge the PR to main.
---

# Review & Merge Workflow

Follow these steps in order:

1. **Find the PR** — Run `gh pr list --head $(git branch --show-current)` to find the open PR for the current branch. If no PR exists, tell the user to run `/git` first.

2. **Review code** — Use the code-reviewer agent to review all changes on the current branch vs main:
   - Run `git diff main...HEAD` to get the full diff
   - Check against all MUST CHECK and SHOULD CHECK rules from the code-reviewer agent
   - Report findings grouped by severity: [MUST FIX], [SHOULD FIX], [NITPICK]

3. **Fix MUST FIX issues** — If there are any [MUST FIX] issues, fix them, commit, and push before proceeding.

4. **Merge** — Once review passes (no MUST FIX issues), merge the PR:
   ```
   gh pr merge --squash --delete-branch
   ```

5. **Confirm** — Show the user that the PR was merged and the branch was cleaned up. Switch back to main and pull: `git checkout main && git pull`
