const fs = "fs"

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

const addAction = (name) => (action) => {
    let newAction = {}
    newAction[name] = action
    eventActions.push(newAction)
    return Limitless
}

const defaultFileHandler = (contents) => {
    let value = JSON.parse(contents)
    if (!value.config)
        value.config = {}

    if (!value.jobs)
        value.jobs = []
    return value
}

let jobDefinitions = []
let eventActions = []

let argumentHandlers = {}
let runHandlers = {}
let triggerHandlers = {}

const Limitless = {
    clear: () => {
        jobDefinitions = []
        eventActions = []

        argumentHandlers = {}
        runHandlers = {}
        triggerHandlers = {}
    },
    withJobDefinition: (jobDefinition) => {
        jobDefinitions.push(jobDefinition)
        return Limitless
    },
    forFile: (filename, handler = defaultFileHandler) => {
        fs.readFile(filename, 'utf8', (error, contents) => {
            if (error)
                throw Error(`Something went wrong - ${error}`)
            Limitless.withJobDefinition(handler(contents))
        })

        return Limitless
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
        return Limitless
    },
    withArgumentHandlers: (handlers) => {
        Object.entries(handlers).forEach(([key, value]) =>
            Limitless.withArgumentHandler(key, value))
        return Limitless
    },
    withRunHandler: (name, action) => {
        runHandlers[name] = action
        return Limitless
    },
    withRunHandlers: (handlers) => {
        Object.entries(handlers).forEach(([key, value]) =>
            Limitless.withRunHandler(key, value))
        return Limitless
    },
    withTriggerHandler: (name, action) => {
        triggerHandlers[name] = action
        return Limitless
    },
    withTriggerHandlers: (handlers) => {
        Object.entries(handlers).forEach(([key, value]) =>
            Limitless.withTriggerHandler(key, value))
        return Limitless
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

module.exports.Limitless = Limitless
module.exports.defaultFileHandler = defaultFileHandler

