const fs = require("fs")

const getMethods = (obj) =>
    Object.getOwnPropertyNames(obj)
        .filter(name => typeof obj[name] === 'function' && name !== 'constructor')

const addDefault = (object, key, value) => {
    if(!object[key])
        object[key] = value
}

const defaultFileHandler = (contents) => {
    const value = JSON.parse(contents)
    addDefault(value, 'config', {})
    addDefault(value, 'jobs', [])
    addDefault(value, 'pipeline', [])
    return value
}

const MUTATING_METHODS = new Set(['pop', 'push', 'shift', 'unshift', 'splice',])

const runMethod = (collection, method, params) => {
    if(MUTATING_METHODS.has(method)) {
        collection[method](...params)
        return collection
    } else {
        return Array.isArray(params) ?
            collection[method](...params) :
            collection[method](params)
    }
}

const Limitless = (
        {
           jobDefinitions = [],
           pipelineDefinitions = [],
           config = {},
           eventModifiers = [],
           argumentHandlers = {},
           runHandlers = {},
           triggerHandlers = {},
        } = {}
    ) => {
        const applyConfig = (newJob) => {
            const {runType} = newJob
            addDefault(newJob, 'arguments', [])
            addDefault(newJob, 'triggers', [])

            newJob.args = (event) =>
                newJob.arguments
                    .reduce((previousValue, {type, ...argumentDefinitions}) =>
                        argumentHandlers[type](previousValue, argumentDefinitions), event)

            if(BUILTIN_RUN_HANDLERS.has(runType) && !runHandlers[runType])
                core.withRunHandler(runType, Builtins.runHandlers[runType])

            newJob.arguments.filter(({type}) =>
                BUILTIN_ARGUMENT_HANDLERS.has(type) && !argumentHandlers[type]
            ).forEach(({type}) =>
                core.withArgumentHandler(type, Builtins.argumentHandlers[type]))

            newJob.triggers.filter(({type}) =>
                BUILTIN_TRIGGERS.has(type) && !triggerHandlers[type]
            ).forEach(({type}) =>
                core.withTriggerHandler(type, Builtins.triggerHandlers[type])
            )
            return newJob
        }

        jobDefinitions.forEach(applyConfig)

        const apply = (job, name, event, pastResults) =>
            runHandlers[job.runType](job.args(event), job, name, pastResults, event, config)

        const EventModifiers = {
            ...getMethods(Array.prototype).reduce((methods, name) => {
                methods[name] = (...params) => {
                    const newModifier = {}
                    newModifier[name] = params
                    eventModifiers.push(newModifier)
                    return core
                }
                return methods
            }, {}),
            flatten: (depth = Infinity) =>
                eventModifiers.push({flat: depth,}) &&
                core,
        }

        const core = {
            ...EventModifiers,

            forFile: (filename, handler = defaultFileHandler) => {
                const contents = fs.readFileSync(filename, 'utf8')
                const { jobs, config, pipeline } = handler(contents)
                jobs.forEach(core.withJobDefinition)
                core.withConfig(config)
                core.withPipeline(pipeline)
                return core
            },
            withConfig: (additionalConfig) =>
                config = {...config, ...additionalConfig,} && core,
            withJobDefinition: ({runType, ...rest}) => {
                jobDefinitions.push(applyConfig({ runType, ...rest,}))
                return core
            },
            withPipeline: (pipeline) =>
                pipelineDefinitions.push(pipeline) && core,

            withArgumentHandler:  (name, action) => {
                argumentHandlers[name] = action
                return core
            },
            withRunHandler: (name, action) => {
                runHandlers[name] = action
                return core
            },
            withTriggerHandler:  (name, action) => {
                triggerHandlers[name] = action
                return core
            },
            process: (...events) => {
                const allDefinitions = jobDefinitions.map((value, index) =>
                    [value.name || `job-${index}`, value,])

                const jobLookup = allDefinitions.reduce((result, definition) => {
                    result[definition[0]] = definition[1]
                    return result
                }, {})

                return eventModifiers.reduce((inputEvent, eventModifier) =>
                    Object.entries(eventModifier)
                        .reduce((last, [method, params]) => {
                            const result = runMethod(last, method, params)
                            return Array.isArray(result) ? result : [result,]
                        }, inputEvent), events)
                    .reduce((returnValues, event) =>
                        [...returnValues, ...allDefinitions
                            .filter(([_, jobDefinition]) =>
                                Object.keys(triggerHandlers).length === 0 ||
                                Builtins.triggerHandlers.__any(jobDefinition.triggers, event, triggerHandlers))
                            .map(([name, jobDefinition]) =>
                                    pipelineDefinitions
                                        .filter(pipeline =>
                                            pipeline.triggers.includes(name))
                                        .reduce((result, definition) =>
                                                definition.steps.reduce((result, jobName) =>
                                                        apply(jobLookup[jobName], jobName, result, returnValues),
                                                    result),
                                            apply(jobDefinition, name, event, returnValues))),], [])
            },
        }

    return core
}

const Builtins = {
    argumentHandlers: {
        __fromRegex: (event, { definition }) => {
            const regexMatch = event.match(new RegExp(definition))
            return regexMatch && regexMatch.length > 1 ? regexMatch.slice(1) : regexMatch
        },
        __fromJson: (event) =>
            JSON.parse(event),
    },
    runHandlers: {
        __identity: (args) => args,
        __toJson: (args) => JSON.stringify(args),
    },
    triggerHandlers: {
        __all: (triggers, event, triggerHandlers) =>
            (triggers || []).reduce((previousValue, {type, definition}) =>
                previousValue &&
                triggerHandlers[type](definition, event, triggerHandlers), true),
        __any: (triggers, event, triggerHandlers) =>
            (triggers || []).reduce((previousValue, {type, definition}) =>
                previousValue ||
                triggerHandlers[type](definition, event, triggerHandlers), false),
    },
}

const keySet = (o) =>
    new Set(Object.keys(o))

const BUILTIN_ARGUMENT_HANDLERS = keySet(Builtins.argumentHandlers),
    BUILTIN_TRIGGERS = keySet(Builtins.triggerHandlers),
    BUILTIN_RUN_HANDLERS = keySet(Builtins.runHandlers)

module.exports.Limitless = Limitless
module.exports.defaultFileHandler = defaultFileHandler

