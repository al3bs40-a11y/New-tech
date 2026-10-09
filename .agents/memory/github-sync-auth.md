---
name: GitHub sync authentication
description: Distinguish GitHub API integration access from Replit's Git source-control authentication.
---

A connected GitHub API integration does not necessarily authenticate Git transport commands such as `git push`, and it does not enable Replit Auto-sync by itself.

**Why:** Replit's API connector and the Git provider link used by the workspace's Git pane are separate authorization paths.

**How to apply:** For ongoing repository sync, connect the GitHub account and repository in Replit's Git pane and enable Auto-sync; verify the Git transport before assuming a connected API integration is sufficient.
