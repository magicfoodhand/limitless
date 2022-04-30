# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.5] - 2022-04-29
### Changed
- removed _build from .npmignore, remove limitless.ts from files

## [2.0.4] - 2022-04-29
## [2.0.3] - 2022-04-29
## [2.0.2] - 2022-04-29
## [2.0.1] - 2022-04-29

NOTE: These versions will not work

**2.0.1 & 2.0.2 not published to npm** 
### Changed
- updated README 
- updated author and repo
- ignore extra files, setup github actions. Not published to npm.

## [2.0.0] - 2022-02-27
### Added
- Created `CHANGELOG.md` to keep track of changes
- Typescript Support, source map is included
### Changed
- target ES6
- RunHandlers, TriggerHandlers, and ArgumentHandlers now accept an object instead of positional arguments.
- Converted to Typescript
- Limitless is a class 
  - `new` is required
- Build output is no longer minified/uglified
- switched from mocha to jest
  - Removed nyc coverage in favor of jest
- switched from jshint to eslint
### Removed
- Event Modifiers have been removed,
  use [Array.prototype](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
  and [#flat(Infinity)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat) on
  the Event instead.
- `Limitless#forFile` and `defaultFileHandler` have been removed, here's the equivalent if you need a replacement.
```javascript
const contents = fs.readFileSync(filename, 'utf8')
const {config = {}, jobs = [], pipeline = [], ...rest} = JSON.parse(contents)
jobs.forEach(core.withJobDefinition)
core.withConfig(config)
pipeline.forEach(core.withPipeline)
```

## [1.0.9] - 2022-02-26
### Changed
- Added API change notice for RunHandler, TriggerHandler, and ArgumentHandler. The following warning log will appear when 
`Limitless#withArgumentHandler`, `Limitless#withRunHandler`, and `Limitless#withTriggerHandler` are called, 
`${type} switches from positional arguments to object arguments in the next major release of limitless. See README for more information.`

## [1.0.8] - 2022-02-26
### Changed
- Added deprecation notice for EventModifiers, `Limitless#forFile`, and `defaultFileHandler`. The following warning log will appear
whenever those methods are called, `${type} is deprecated, and will be removed in the next major release of limitless. See README for more information.`

## [1.0.7] - 2021-05-31

## [1.0.6] - 2021-05-31

## [1.0.5] - 2021-05-31

## [1.0.4] - 2021-05-31

## [1.0.3] - 2021-05-28

## [1.0.2] - 2021-02-25

## [1.0.1] - 2021-01-22

## [1.0.0] - 2021-01-22

## [0.1.5] - 2021-01-13

## [0.1.4] - 2021-01-12

## [0.1.3] - 2021-01-12

## [0.1.2] - 2021-01-12