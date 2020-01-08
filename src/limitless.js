const fs = "fs"

const defaultFileHandler = (contents) => {
    let value = JSON.parse(contents)
    if (!value.config)
        value.config = {}

    if (!value.jobs)
        value.jobs = []
    return value
}

const Limitless = (
        jobDefinitions = [],
        eventActions = [],
        argumentHandlers = {},
        runHandlers = {},
        triggerHandlers = {}
    ) => {
        const addAction = (name) => (action) => {
            let newAction = {}
            newAction[name] = action
            eventActions.push(newAction)
            return core
        }

        const apply = (job, name, event, pastResults) => {
            let isTriggered = Object.keys(triggerHandlers).length === 0
                || job.triggers
                && job.triggers.map(trigger =>
                    triggerHandlers[trigger.type](trigger.definition, event))
                    .reduce((previousValue, currentValue) =>
                        previousValue || currentValue, false)

            if (isTriggered) {
                const args = (job.arguments || [])
                    .reduce((previousValue, argument) =>
                            argumentHandlers[argument.type](previousValue)
                        , event)

                pastResults.push(runHandlers[job.runType](args, job, name, pastResults, event))
            }
        }

        const core = {
            withJobDefinition: (jobDefinition) => {
                jobDefinitions.push(jobDefinition)
                return core
            },
            forFile: (filename, handler = defaultFileHandler) => {
                fs.readFile(filename, 'utf8', (error, contents) => {
                    if (error)
                        throw Error(`Something went wrong - ${error}`)
                    core.withJobDefinition(handler(contents))
                })

                return core
            },
            every: addAction('every'),
            find: addAction('find'),
            findIndex: addAction('findIndex'),
            map: addAction('map'),
            flatMap: addAction('flatMap'),
            filter: addAction('filter'),
            some: addAction('some'),
            withArgumentHandler: (name, action) => {
                argumentHandlers[name] = action
                return core
            },
            withArgumentHandlers: (handlers) => {
                Object.entries(handlers).forEach(([key, value]) =>
                    core.withArgumentHandler(key, value))
                return core
            },
            withRunHandler: (name, action) => {
                runHandlers[name] = action
                return core
            },
            withRunHandlers: (handlers) => {
                Object.entries(handlers).forEach(([key, value]) =>
                    core.withRunHandler(key, value))
                return core
            },
            withTriggerHandler: (name, action) => {
                triggerHandlers[name] = action
                return core
            },
            withTriggerHandlers: (handlers) => {
                Object.entries(handlers).forEach(([key, value]) =>
                    core.withTriggerHandler(key, value))
                return core
            },
            process: (event) => {
                const allDefinitions = jobDefinitions.map((value, index) =>
                    [value.name || `job-${index}`, value])

                return eventActions.reduce((inputEvent, eventAction) =>
                    Object.entries(eventAction)
                        .reduce((last, [method, action]) =>
                            last[method](action), inputEvent), [event])
                    .reduce((previousValues, event) => {
                        allDefinitions.forEach(([name, jobDefinition]) =>
                            apply(jobDefinition, name, event, previousValues))
                        return previousValues
                    }, [])
            }
        }
    return core
}

module.exports.Limitless = Limitless
module.exports.defaultFileHandler = defaultFileHandler

