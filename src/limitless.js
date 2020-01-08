const fs = "fs"

const addDefault = (base, property, value) =>
    !base[property] && (base[property] = value)

const defaultFileHandler = (contents) => {
    const value = JSON.parse(contents)
    addDefault(value, 'config', {})
    addDefault(value, 'jobs', [])
    addDefault(value, 'pipeline', [])
    return value
}

const prepareEventActions = (eventActions, event) => {
    return eventActions.reduce((inputEvent, eventAction) =>
        Object.entries(eventAction)
            .reduce((last, [method, action]) =>
                last[method](action), inputEvent), [event])
}

const Limitless = (
        {
           jobDefinitions = [],
           pipelineDefinitions = [],
           config = [],
           eventActions = [],
           argumentHandlers = {},
           runHandlers = {},
           triggerHandlers = {},
        } = {}
    ) => {
        const addAction = (name) => (action) => {
            let newAction = {}
            newAction[name] = action
            eventActions.push(newAction)
            return core
        }

        const apply = (job, name, event, pastResults) => {
            const args = (job.arguments || [])
                .reduce((previousValue, argument) =>
                    argumentHandlers[argument.type](previousValue), event)

            return runHandlers[job.runType](args, job, name, pastResults, event)
        }

        const addHandler = (handlers) => (name, action) => {
            handlers[name] = action
            return core
        }

        const addHandlers = (newHandlers, handler) => {
            Object.entries(newHandlers)
                .forEach(([key, value]) =>
                    handler(key, value))
            return core
        }

        const isTriggered = (jobDefinition, event) =>
            Object.keys(triggerHandlers).length === 0
            || jobDefinition.triggers
            && jobDefinition.triggers
                .map(trigger =>
                    triggerHandlers[trigger.type](trigger.definition, event))
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
                    const {jobs, config, pipeline} = handler(contents)
                    jobs.forEach(core.withJobDefinition)
                    core.withConfig(config)
                    core.withPipeline(pipeline)
                })

                return core
            },
            withConfig: (additionalConfig) =>
                config = {...config, ...additionalConfig} && core,
            withJobDefinition: (jobDefinition) =>
                jobDefinitions.push(jobDefinition) && core,
            withPipeline: (pipeline) =>
                pipelineDefinitions.push(pipeline) && core,

            withArgumentHandler: addHandler(argumentHandlers),
            withArgumentHandlers: (handlers) =>
                addHandlers(handlers, core.withArgumentHandler),

            withRunHandler: addHandler(runHandlers),
            withRunHandlers: (handlers) =>
                addHandlers(handlers, core.withRunHandler),

            withTriggerHandler: addHandler(triggerHandlers),
            withTriggerHandlers: (handlers) =>
                addHandlers(handlers, core.withTriggerHandler),

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

