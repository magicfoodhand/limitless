const fs = require("fs")

const deprecated = (deprecationMessage, are = false) => {
    console.warn(`${deprecationMessage} ${are ? 'are' : 'is'} deprecated, and will be removed in the next major release of limitless. See README for more information.`)
}

const apiChange = (type) => {
    console.warn(`${type} switches from positional arguments to object arguments in the next major release of limitless. See README for more information.`)
}

const getMethods = (obj) =>
    Object.getOwnPropertyNames(obj).filter(name =>
        typeof obj[name] === 'function' && name !== 'constructor')

const addDefault = (object, key, value) => {
    if (!object[key])
        object[key] = value
}

const defaultFileHandler = (contents) => {
    deprecated('`defaultFileHandler`')
    const {config = {}, jobs = [], pipeline = [], ...rest} = JSON.parse(contents)
    return {config, jobs, pipeline, ...rest,}
}

const MUTATING_METHODS = new Set(['pop', 'push', 'shift', 'unshift', 'splice',])

const runMethod = (collection, method, params) => {
    deprecated(`EventModifiers (${method})`, true)
    if (MUTATING_METHODS.has(method)) {
        collection[method](...params)
        return collection
    } else {
        const result = Array.isArray(params) ?
            collection[method](...params) :
            collection[method](params)
        return Array.isArray(result) ? result : [result,]
    }
}

const orDefault = (handlers, builtins, type) =>
    handlers[type] || builtins[type]

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
    const registerDefinition = (newJob) => {
        addDefault(newJob, 'arguments', [])
        addDefault(newJob, 'triggers', [])

        newJob.triggers.filter(({type}) =>
            BUILTIN_TRIGGERS.has(type) && !triggerHandlers[type]
        ).forEach(({type}) =>
            core.withTriggerHandler(type, Builtin.triggerHandlers[type])
        )
        return newJob
    }

    jobDefinitions.forEach(registerDefinition)

    const apply = (job, name, event, pastResults) => {
        const args = job.arguments.reduce((previousValue, {type, ...argumentDefinitions}) => {
            const handler = orDefault(argumentHandlers, Builtin.argumentHandlers, type)
            return handler(previousValue, argumentDefinitions, argumentHandlers)
        }, event)

        const runHandler = orDefault(runHandlers, Builtin.runHandlers, job.runType)
        return runHandler(args, job, name, pastResults, event, config)
    }

    const self = (action) => (...args) => {
        action(...args)
        return core
    }

    const EventModifiers = {
        ...getMethods(Array.prototype).reduce((methods, name) => {
            methods[name] = self((...params) => {
                const newModifier = {}
                newModifier[name] = params
                eventModifiers.push(newModifier)
            })
            return methods
        }, {}),
        flatten: self((depth = Infinity) =>
            eventModifiers.push({flat: depth,})),
    }

    const core = {
        ...EventModifiers,

        forFile: self((filename, handler = defaultFileHandler) => {
            deprecated('`forFile`')
            const contents = fs.readFileSync(filename, 'utf8')
            const {jobs, config, pipeline} = handler(contents)
            jobs.forEach(core.withJobDefinition)
            core.withConfig(config)
            pipeline.forEach(core.withPipeline)
        }),
        withConfig: self((additionalConfig) =>
            config = {...config, ...additionalConfig,}),
        withJobDefinition: self((newJob) =>
            jobDefinitions.push(registerDefinition(newJob))),
        withPipeline: self((pipeline) =>
            pipelineDefinitions.push(pipeline)),
        withArgumentHandler: self((name, action) => {
            apiChange('`ArgumentHandler`')
            argumentHandlers[name] = action
        }),
        withRunHandler: self((name, action) => {
            apiChange('`RunHandler`')
            runHandlers[name] = action
        }),
        withTriggerHandler: self((name, action) => {
            apiChange('`TriggerHandler`')
            triggerHandlers[name] = action
        }),
        process: (...events) => {
            const allDefinitions = jobDefinitions.map((jobDefinition, index) => {
                return {
                    name: jobDefinition.name || `job-${index}`,
                    jobDefinition,
                }
            })

            const jobLookup = allDefinitions.reduce((result, {name, jobDefinition}) => {
                result[name] = jobDefinition
                return result
            }, {})

            const preparedEvents = eventModifiers.reduce((inputEvent, eventModifier) =>
                    Object.entries(eventModifier).reduce((last, [method, params]) =>
                        runMethod(last, method, params), inputEvent),
                events)

            return preparedEvents.reduce((returnValues, event) =>
                [...returnValues, ...allDefinitions
                    .filter(({_, jobDefinition}) =>
                        Object.keys(triggerHandlers).length === 0 ||
                        Builtin.triggerHandlers.__any(jobDefinition.triggers, event, triggerHandlers))
                    .map(({name, jobDefinition}) =>
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

const SharedHandlers = {
    __identity: (args) => args,
    __fromJson: (event) => JSON.parse(event),
    __toJson: (args) => JSON.stringify(args),
}

const Builtin = {
    argumentHandlers: {
        ...SharedHandlers,
        __fromRegex: (event, {definition}) => {
            const regexMatch = event.match(new RegExp(definition))
            return regexMatch && regexMatch.length > 1 ? regexMatch.slice(1) : regexMatch
        },
        __keyword: (event, {definition = {}}, argumentHandlers) =>
            Object.entries(definition).reduce((previousValue, [key, {type, definition}]) => {
                const handler = orDefault(argumentHandlers, Builtin.argumentHandlers, type)
                previousValue[key] = handler(event, {definition,}, argumentHandlers)
                return previousValue
            }, {}),
        __positional: (event, {definition = []}, argumentHandlers) =>
            definition.map(({type, definition}) => {
                const handler = orDefault(argumentHandlers, Builtin.argumentHandlers, type)
                return handler(event, {definition,}, argumentHandlers)
            }),
        __env: (_, {definition}) =>
            process.env[definition],
        __value: (_, {definition}) =>
            definition,
    },
    runHandlers: {
        ...SharedHandlers,
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
        __not: (definition, event, triggerHandlers) =>
            definition &&
            !triggerHandlers[definition.type](definition.definition, event, triggerHandlers),
    },
}

const BUILTIN_TRIGGERS = new Set(Object.keys(Builtin.triggerHandlers))

module.exports.Limitless = Limitless
module.exports.defaultFileHandler = defaultFileHandler
