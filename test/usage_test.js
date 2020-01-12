const chai = require('chai')
chai.should();

const limitless = require("../src/limitless.js")
const Limitless = limitless.Limitless
const defaultFileHandler = limitless.defaultFileHandler

describe('Limitless', () => {
    describe('forFile', () => {
        it('reads defaults from a file', () => {
            const jobDefinitions = []
            Limitless({jobDefinitions}).forFile('test/test.json')
            const { runType, arguments, triggers } = jobDefinitions[0]
            runType.should.equal('__identity')
            arguments.should.deep.equal([])
            triggers.should.deep.equal([])
        })
    })

    describe('process', () => {
        it('empty job', () => {
            Limitless().process()
                .should.deep.equal([])
        })

        it('empty job - ignores event', () => {
            Limitless().process('ignored')
                .should.deep.equal([])
        })

        it('minimal job', () => {
            Limitless().withJobDefinition({
                runType: 'split'
            }).withRunHandler('split', event => event.split(','))
                .process("1,2,3,4")
                .should.deep.equal([["1", "2", "3", "4"]])
        })

        it('minimal job - multiple events', () => {
            Limitless().withJobDefinition({
                runType: '__identity'
            })
                .process(1,2,3,4)
                .should.deep.equal([1, 2, 3, 4])
        })

        it('multiple jobs', () => {
            let jobDefinitions = [{
                runType: 'split'
            }]
            let first = Limitless({jobDefinitions})
                .withRunHandler('split', event => event.split(','))

            let second = Limitless({jobDefinitions})
                .withRunHandler('split', event => event.split(',').map(e => parseInt(e)))

            first.process("1,2,3,4")
                .should.deep.equal([["1", "2", "3", "4"]])
            second.process("1,2,3,4")
                .should.deep.equal([[1, 2, 3, 4]])
        })

        it('all jobs run without triggers', () => {
            Limitless({
                jobDefinitions: [
                    {runType: 'parseInt'},
                    {runType: 'addLetter'}
                ], runHandlers: {
                    parseInt: e =>
                        e.split(',').map(el => parseInt(el)),
                    addLetter: e => "A" + e + "B"
                }
            }).process("1,2,3,4")
                .should.deep.equal([[1, 2, 3, 4], "A1,2,3,4B"])
        })
    })

    describe('state management', () => {
        it('shared state with multiple jobs can cause issues', () => {
            let jobDefinitions = [{
                runType: 'split'
            }]
            let runHandlers = {}
            let first = Limitless({runHandlers, jobDefinitions})
                .withRunHandler('split', event => event.split(','))

            let second = Limitless({runHandlers, jobDefinitions})
                .withRunHandler('split', event => event.split(',').map(e => parseInt(e)))

            // second's split method overrides first
            first.process("1,2,3,4")
                .should.deep.equal(second.process("1,2,3,4"))
        })
    })

    describe('arguments', () => {
        it('extract arguments from event', () => {
            Limitless().withJobDefinition({
                runType: 'sum', arguments: [{
                    type: "extract"
                }]
            })
                .withRunHandler('sum', values =>
                    values.reduce((a, b) => a + b, 0))
                .withArgumentHandler('extract', element =>
                    element['values'])
                .process({values: [1, 2, 3, 4]})
                .should.deep.equal([10])
        })
    })

    describe('triggers', () => {
        it('triggered jobs run', () => {
            Limitless()
                .withJobDefinition( {
                    runType: 'addLetter', triggers: [{
                        type: "regex", definition: "\\D+"
                    }]
                })
                .withRunHandler('addLetter', e => "A" + e + "B")
                .withTriggerHandler('regex', (definition, event) =>
                    event.match(new RegExp(definition)))
                .process('1','C','2','3','4')[0]
                .should.equal("ACB")
        })

        it("don't run jobs without matching triggers if any trigger handlers are registered", () => {
            Limitless({
                jobDefinitions: [{
                    runType: 'parseInt'
                }], triggerHandlers: { wontBeRun: e => e }
            }).process("1,2,3,4")
                .should.deep.equal([])
        })

        it('only runs triggers until one is fired', () => {
            let calls = 0
            const jobDefinitions = [
                {
                    runType: 'parseInt', triggers: [{
                        type: "regex", definition: "abc"
                    }, {
                        type: "regex", definition: "\\d+"
                    }, {
                        type: "regex", definition: "def"
                    }]
                }
            ]
            Limitless({jobDefinitions})
                .withRunHandler('parseInt', el => parseInt(el))
                .withTriggerHandler('regex', (definition, event) => {
                    calls++
                    return event.match(new RegExp(definition))
                })
                .flatMap(event =>
                    event.split(','))
                .map(entry => entry.trim())
                .process("1")
                .should.deep.equal([1])
            calls.should.equal(2)
        })
    })

    describe('built in run handlers', () => {
        describe('__identity', () => {
            it('returns input', () => {
                Limitless().withJobDefinition({
                    runType: "__identity"
                }).process("It Works")
                    .should.deep.equal(["It Works"])
            })
        })

        describe('__toJson', () => {
            it('json as string', () => {
                Limitless().withJobDefinition({
                    runType: "__toJson"
                }).process([1, 2, 3, 4])
                    .should.deep.equal(["[1,2,3,4]"])
            })
        })
    })

    describe('built in argument handlers', () => {
        describe('__fromJson', () => {
            it('match groups are sent as args', () => {
                Limitless().withJobDefinition({
                    runType: '__identity', arguments: [
                        { type: '__fromJson' }
                    ]
                }).process('[1,2,3,4]')
                    .should.deep.equal([
                    [1,2,3,4]
                ])
            })
        })

        describe('__fromRegex', () => {
                it('match groups are sent as args', () => {
                    Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            { type: '__fromRegex', definition: "(\\d+),2,3,(\\d+)"}
                        ]
                    }).process('1,2,3,4')
                        .should.deep.equal([
                        ['1','4']
                    ])
                })

                it('no match results in null', () => {
                    Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            { type: '__fromRegex', definition: "(\\d+),2,3,(\\d+)"}
                        ]
                    }).process('hello')
                        .should.deep.equal([null])
                })
        })
    })

    describe('built in trigger handlers', () => {
        describe('__any', () => {
            it('does not run by default', () => {
                Limitless().withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__any", definition: []
                    }]
                }).process(true)
                    .should.deep.equal([])
            })

            it('does not run by default - no definition', () => {
                Limitless().withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__any"
                    }]
                }).process(true)
                    .should.deep.equal([])
            })

            it('requires any triggers to match', () => {
                const triggerHandlers = {
                    isPhoneNumber: (_, event) =>
                        typeof event === 'string'
                        && event.match(/\d{3}-\d{3}-\d{4}/),
                    contains666: (_, event) =>
                        event === 666
                        || typeof event === 'string'
                        && event.includes('666'),
                }
                Limitless({triggerHandlers}).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__any", definition: [
                            {type: "isPhoneNumber"},
                            {type: "contains666"}
                        ]
                    }]
                })
                    .flatMap(event => event.flatMap(e => e))
                    .process([
                        ['Name', 'Phone', 'Favorite Number'],
                        ['John Smith', '555-123-4567', 666],
                        ['Jane Smith', '503-555-4567', 2],
                        ['Bob Smith', '508-273-6667', 2]
                    ])
                    .should.deep.equal(['555-123-4567', 666, '503-555-4567', '508-273-6667'])
            })
        })

        describe('__all', () => {
            it('runs by default', () => {
                Limitless().withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: []
                    }]
                }).process(true)
                    .should.deep.equal([true])
            })

            it('runs by default - no definition', () => {
                Limitless().withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all"
                    }]
                }).process(true)
                    .should.deep.equal([true])
            })

            it('fails unless all triggers match', () => {
                const triggerHandlers = {
                    isFalsy: (event) => !event,
                    isTruthy: (event) => event,
                }
                Limitless({triggerHandlers}).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "isFalsy"},
                            {type: "isTruthy"}
                        ]
                    }]
                }).process(true)
                    .should.deep.equal([])
            })

            it('only runs triggers while value is truthy', () => {
                let i = 1
                let j = 1
                const triggerHandlers = {
                    increment1: (_) => i++ && false,
                    square4: (_) => j = i, // Not Run
                }
                Limitless({triggerHandlers}).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "increment1"},
                            {type: "square4"},
                        ]
                    }]
                }).process(true)
                    .should.deep.equal([])
                i.should.equal(2)
                j.should.equal(1)
            })

            it('runs triggers in order', () => {
                let i = 1
                const triggerHandlers = {
                    increment1: (_) => i === 1 && i++,
                    double2: (_) => i === 2 && (i *= 2),
                    square4: (_) => i === 4 && (i *= 4),
                }
                Limitless({triggerHandlers}).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "increment1"},
                            {type: "double2"},
                            {type: "square4"}
                        ]
                    }]
                }).process(true)
                    .should.deep.equal([true])
                i.should.equal(16)
            })

            it('requires all triggers to match', () => {
                const triggerHandlers = {
                    isString: (_, event) =>
                        typeof event === 'string',
                    isPhoneNumber: (_, event) =>
                        event.match(/\d{3}-\d{3}-\d{4}/),
                    contains666: (_, event) =>
                        event.includes('666'),
                }
                Limitless({triggerHandlers}).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "isString"},
                            {type: "isPhoneNumber"},
                            {type: "contains666"}
                        ]
                    }]
                })
                    .flatMap(event => event.flatMap(e => e))
                    .process([
                        ['Name', 'Phone', 'Favorite Number'],
                        ['John Smith', '555-123-4567', 666],
                        ['Jane Smith', '503-555-4567', 2],
                        ['Bob Smith', '508-273-6667', 2]
                    ])
                    .should.deep.equal(['508-273-6667'])
            })
        })
    })

    describe('#pipeline', () => {
        it('triggered jobs run pipeline', () => {
            const config = {
                jobDefinitions: [
                    {
                        runType: 'parseInt'
                    },
                    {
                        runType: 'convertInts', triggers: [{
                            type: "regex", definition: "\\d+"
                        }]
                    }
                ], runHandlers: {
                    parseInt: el => parseInt(el),
                    convertInts: e => e.trim().slice(1)
                }
            }

            Limitless(config).withPipeline({
                triggers: ["job-1"],
                steps: [
                    "job-0", // default job name
                ]
            }).withTriggerHandler('regex', (definition, event) =>
                event.match(new RegExp(definition))
            ).flatMap(event =>
                event.split(',')
            ).process("A11, B24, C32, D42")
                .should.deep.equal([11, 24, 32, 42])
        })
    })

    describe('#defaultFileHandler()', () => {
        it('should try to parse json - default', () => {
            const defaultValue = {
                config: {},
                jobs: [],
                pipeline: [],
            }
            const value = defaultFileHandler("{}")
            defaultValue.should.deep.equal(value)
        })
    })
})