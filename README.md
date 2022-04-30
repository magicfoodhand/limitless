[![Node.js Package](https://github.com/magicfoodhand/limitless/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/magicfoodhand/limitless/actions/workflows/npm-publish.yml)
[![coverage report](https://gitlab.com/inapinch/limitless/badges/master/coverage.svg)](https://gitlab.com/inapinch/limitless/commits/master)

# Limitless

A small configurable dependency-free event handler that targets ES6.

## Installation

```yarn add limitlessjs```

```npm install --save limitlessjs```

## Usage

```javascript
import {Limitless} from 'limitlessjs'

const limitless = new Limitless()
 // or
const limitless = Limitless.create()
```

## Upgrading to 2.x

### Breaking changes
- This library has been converted to Typescript, Limitless is a class (`new` is required)
- RunHandlers, TriggerHandlers, and ArgumentHandlers now accept an object instead of positional arguments.
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

## Components

- Events
- Job Definitions
- Run Handlers
- Triggers & Trigger Handlers
- Arguments & Argument Handlers
- Config
- Pipeline

### Events

The input to Limitless, one or more passed into #process

```javascript
    EventHandler.create()
      .withJobDefinition({runType: '__identity'})
      .process(1, 2, 3, 4) // Output: [1, 2, 3, 4]
```

### Job Definitions

Core building block of Limitless that defines what can happen when an Event is received.

```javascript
    // JobDefinition
    { 
        runType: string, 
        name: string, 
        triggers: [Trigger], 
        arguments: [Argument], 
        ...rest 
    } 
```

- runType (required) - the name of the RunHandler that should be called to process this job
- name (required, defaults to job-[number], e.g. job-0) - the name of this job
- triggers (optional, see Triggers) - What triggers this job to run
- arguments (optional, defaults to event) - How should event be passed to job runner
- add any additional fields that would be useful for your Run Handlers

### Run Handlers

Run a job definition, if triggered.

```javascript
    // Run Handler
    (
        args: [], 
        job: JobDefinition, 
        name: string, 
        pastResults: [], 
        event: any, 
        config: Config
    ) => any
```

- argsFromEvent - result of applying Argument Handlers on the Event
- job - the full job definition
- name - the name of the job (e.g job-0)
- pastResults - anything that has already been processed
- event - the event that was passed into Argument Handlers

#### Built In Run Handlers

- __identity - returns input
- __toJson - converts input to json string
- __fromJson - converts string to json object

### Triggers & Trigger Handlers

Decides when a job should run. By default if no trigger handlers are registered then all jobs are run, if any trigger
handlers have been registered then only the jobs with matching triggers will run.

#### Arguments

- type (required) - the name of the TriggerHandler that should be called to process this trigger
- definition (optional, defaults to undefined) - additional config required by Trigger

#### Trigger Handlers

```javascript
    // Trigger Handler
    ({
        definition: any,
        event: any, 
        handlers: Object
    }) => boolean 
```

#### Built In Trigger Handlers

- __all - Requires all triggers to match
- __any - Requires any triggers to match, default behavior
- __not - Inverts the result of trigger

### Arguments

The object passed into a RunHandler, the result of applying Argument Handlers on the event

#### Argument Handler

```javascript
    // Argument Handler
    ({
        event: any, 
        definition: Object
    }) => any
```

#### Built In Argument Handlers

- __identity - returns input
- __toJson - converts input to json string
- __fromJson - converts string to json object
- __fromRegex - definition is a regular expression
- __keyword - definition is an object of keys to argument handlers
- __positional - definition is an array of argument handlers
- __env - definition is the name of the environment variable to read
- __value - use the value from definition

### Config

Shared object passed into Run Handlers

### Pipeline

Define sets of jobs that should run into each other. e.g. ```job3(job2(job1(event)))```

#### Arguments

- triggers (required) - the names of jobs that start this pipeline
- steps (required) - the names of jobs that run, in order, in this pipeline
