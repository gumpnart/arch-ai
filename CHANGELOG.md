# Changelog

## [Unreleased]

### Fixed
- **bridge**: Fixed TypeScript build error TS7053 in `src/index.ts` — wildcard route params accessed via numeric index `req.params[0]` now use the string key `req.params['0']`, which is the correct way to index Express's `ParamsDictionary` type. Affected the GET/PUT/DELETE `/diagrams/*` handlers (lines 221, 233, 246).
