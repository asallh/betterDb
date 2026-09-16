## Summary

<!-- What changed for users? -->

## Release (dev → main only)

- [ ] Exactly one label: `release:patch` | `release:minor` | `release:major`
- [ ] Optional stage label: `release:alpha` | `release:beta` | `release:rc` (omit for stable)
- [ ] Update `CHANGELOG.md` under `[Unreleased]` / new version section
- [ ] CI and **Release PR** checks are green

> Adding a release label triggers a bot bump on `dev`. Merging publishes installers to GitHub Releases.
