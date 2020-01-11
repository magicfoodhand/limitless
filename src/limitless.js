const fs = "fs"

Object.prototype.applyBlock = function(block) {
    block(this)
    return this
}

const defaultFileHandler = (contents) =>
    JSON.parse(contents).applyBlock(value => {
        if(!value.config)
            value.config = {}

        if(!value.jobs)
            value.jobs = []

        if(!value.pipeline)
            value.pipeline = []
    })

const prepareEventActions = (eventActions, event) =>
    eventActions.reduce((inputEvent, eventAction) =>
        Object.entries(eventAction)
            .reduce((last, [method, action]) =>
                last[method](action), inputEvent), [event])

const Builtins = {
    runHandlers: {
        __identity: (args) => args
    },
    triggerHandlers: {
        __all: (triggers, event, triggerHandlers) =>
            (triggers || []).reduce((previousValue, trigger) =>
                previousValue
                && triggerHandlers[trigger.type](trigger.definition, event, triggerHandlers), true)
    },
}

const BUILTIN_TRIGGERS = new Set(Object.keys(Builtins.triggerHandlers))
const BUILTIN_RUN_HANDLERS = new Set(Object.keys(Builtins.runHandlers))

const Limitless = (
        {
           jobDefinitions = [],
           pipelineDefinitions = [],
           config = {},
           eventActions = [],
           argumentHandlers = {},
           runHandlers = {},
           triggerHandlers = {},
        } = {}
    ) => {
        const addAction = (name) => (action) => {
            eventActions.push({}.applyBlock(newAction => newAction[name] = action))
            return core
        }

        const apply = (job, name, event, pastResults) => {
            const args = (job.arguments || [])
                .reduce((previousValue, { type }) =>
                    argumentHandlers[type](previousValue), event)

            return runHandlers[job.runType](args, job, name, pastResults, event)
        }

        const addHandler = (handlers) => (name, action) => {
            handlers[name] = action
            return core
        }

        const isTriggered = (jobDefinition, event) =>
            Object.keys(triggerHandlers).length === 0
            || (jobDefinition.triggers || [])
                .map(({type, definition}) =>
                    triggerHandlers[type](definition, event, triggerHandlers))
                .reduce((previousValue, currentValue) =>
                    previousValue || currentValue, false)

        const core = {
            // Event Modifiers, (event) => value
            every: addAction('every'),
            find: addAction('find'),
            findIndex: addAction('findIndex'),
            map: addAction('map'),
            flatMap: addAction('flatMap'),
            filter: addAction('filter'),
            some: addAction('some'),

            forFile: (filename, handler = defaultFileHandler) => {
                fs.readFile(filename, 'utf8', (error, contents) => {
                    if (error)
                        throw Error(`Something went wrong - ${error}`)
                    const { jobs, config, pipeline } = handler(contents)
                    jobs.forEach(core.withJobDefinition)
                    core.withConfig(config)
                    core.withPipeline(pipeline)
                })

                return core
            },
            withConfig: (additionalConfig) =>
                config = {...config, ...additionalConfig} && core,
            withJobDefinition: ({triggers = [], runType = '', ...rest}) => {
                jobDefinitions.push({triggers, runType, ...rest})

                if(BUILTIN_RUN_HANDLERS.has(runType))
                    core.withRunHandler(runType, Builtins.runHandlers[runType])

                triggers.forEach(({type}) => {
                    if(BUILTIN_TRIGGERS.has(type))
                        core.withTriggerHandler(type, Builtins.triggerHandlers[type])
                })
                return core
            },
            withPipeline: (pipeline) =>
                pipelineDefinitions.push(pipeline) && core,

            withArgumentHandler: addHandler(argumentHandlers),
            withRunHandler: addHandler(runHandlers),
            withTriggerHandler: addHandler(triggerHandlers),

            process: (event = undefined) => {
                const allDefinitions = jobDefinitions.map((value, index) =>
                    [value.name || `job-${index}`, value])

                const jobLookup = allDefinitions.reduce((result, definition) => {
                    result[definition[0]] = definition[1]
                    return result
                }, {})

                const applyPipeline = (returnValues, event) =>
                    ([name, jobDefinition]) =>
                        pipelineDefinitions
                            .filter(pipeline =>
                                pipeline.triggers.includes(name))
                            .reduce((result, definition) =>
                                    definition.steps.reduce((result, jobName) =>
                                            apply(jobLookup[jobName], jobName, result, returnValues)
                                        , result)
                                , apply(jobDefinition, name, event, returnValues))

                return prepareEventActions(eventActions, event)
                    .reduce((returnValues, event) =>
                        [...returnValues, ...allDefinitions
                            .filter(([_, jobDefinition]) =>
                                isTriggered(jobDefinition, event))
                            .map(applyPipeline(returnValues, event))]
                    , [])
            }
        }
    return core
}

module.exports.Limitless = Limitless
module.exports.defaultFileHandler = defaultFileHandler

