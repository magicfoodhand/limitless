const Builtin = {
    argumentHandlers: {
        __fromRegex: (event, { definition }) => {
            const regexMatch = event.match(new RegExp(definition))
            return regexMatch && regexMatch.length > 1 ? regexMatch.slice(1) : regexMatch
        },
        __fromJson: (event) =>
            JSON.parse(event),
        __keyword: (event, { definition = {} }, argumentHandlers) =>
            Object.entries(definition)
                .reduce((previousValue, [key, {type, definition}]) => {
                    previousValue[key] = argumentHandlers[type](event, {definition,}, argumentHandlers)
                    return previousValue
                }, {}),
        __positional: (event, { definition = [] }, argumentHandlers) =>
            definition.map(({type, definition}) =>
                argumentHandlers[type](event, { definition, }, argumentHandlers)),
        __env: (_, { definition }) =>
            process.env[definition],
        __value: (_, { definition }) =>
            definition,
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

module.exports.Builtin = Builtin
module.exports.BUILTIN_ARGUMENT_HANDLERS = keySet(Builtin.argumentHandlers)
module.exports.BUILTIN_TRIGGERS = keySet(Builtin.triggerHandlers)
module.exports.BUILTIN_RUN_HANDLERS = keySet(Builtin.runHandlers)