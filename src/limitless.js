const fs = "fs"

const addDefault = (base, property, value) =>
    !base[property] && (base[property] = value)

const defaultFileHandler = (contents) =>
    JSON.parse(contents).map(value => {
        addDefault(value, 'config', {})
        addDefault(value, 'jobs', [])
        addDefault(value, 'pipeline', [])
        return value
    })

const Limitless = (
        {
           jobDefinitions = [],
           eventActions = [],
           argumentHandlers = {},
           runHandlers = {},
           triggerHandlers = {}
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

            pastResults.push(runHandlers[job.runType](args, job, name, pastResults, event))
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
                    handler(contents).forEach(core.withJobDefinition)
                })

                return core
            },
            withJobDefinition: (jobDefinition) =>
                jobDefinitions.push(jobDefinition) && core,

            withArgumentHandler: addHandler(argumentHandlers),
            withArgumentHandlers: (handlers) =>
                addHandlers(handlers, core.withArgumentHandler),

            withRunHandler: addHandler(runHandlers),
            withRunHandlers: (handlers) =>
                addHandlers(handlers, core.withRunHandler),

            withTriggerHandler: addHandler(triggerHandlers),
            withTriggerHandlers: (handlers) =>
                addHandlers(handlers, core.withTriggerHandler),

            process: (event) => {
                const allDefinitions = jobDefinitions.map((value, index) =>
                    [value.name || `job-${index}`, value])

                return eventActions.reduce((inputEvent, eventAction) =>
                    Object.entries(eventAction)
                        .reduce((last, [method, action]) =>
                            last[method](action), inputEvent), [event])
                    .reduce((previousValues, event) => {
                        allDefinitions
                            .filter(([_, jobDefinition]) =>
                                isTriggered(jobDefinition, event))
                            .forEach(([name, jobDefinition]) =>
                                apply(jobDefinition, name, event, previousValues))
                        return previousValues
                    }, [])
            }
        }
    return core
}

module.exports.Limitless = Limitless
module.exports.defaultFileHandler = defaultFileHandler

