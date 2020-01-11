const chai = require('chai')
chai.should();

const limitless = require("../src/limitless.js")
const Limitless = limitless.Limitless
const defaultFileHandler = limitless.defaultFileHandler

describe('Limitless', () => {
    describe('#process', () => {
        it('empty job', () => {
            Limitless().process()
                .should.deep.equal([])
        })

        it('multiple jobs', () => {
            let first = Limitless().withJobDefinition({
                runType: 'split'
            }).withRunHandler('split', event => event.split(','))

            let second = Limitless().withJobDefinition({
                runType: 'split'
            }).withRunHandler('split', event => event.split(',').map(e => parseInt(e)))

            first.process("1,2,3,4").should.deep.equal([["1", "2", "3", "4"]])
            second.process("1,2,3,4").should.deep.equal([[1, 2, 3, 4]])
        })

        it('minimal job', () => {
            Limitless().withJobDefinition({
                runType: 'split'
            }).withRunHandler('split', event => event.split(','))
                .process("1,2,3,4")
                .should.deep.equal([["1", "2", "3", "4"]])
        })

        it('job - arguments', () => {
            Limitless().withJobDefinition({
                runType: 'sum', arguments: [{
                    type: "extract"
                }]
            })
                .withRunHandler('sum', values =>
                    values.reduce((a, b) => a + b, 0))
                .withArgumentHandler('extract', element =>
                    element['values'])
                .map(event => JSON.parse(event))
                .process('{"values":[1,2,3,4]}')
                .should.deep.equal([10])
        })

        it('minimal job - map', () => {
            Limitless().withJobDefinition({
                runType: 'parseInt'
            }).withRunHandler('parseInt', e =>
                e.map(el => parseInt(el))
            ).map(event => event.split(','))
                .process("1,2,3,4")
                .should.deep.equal([[1, 2, 3, 4]])
        })

        it('minimal job - flatMap', () => {
            Limitless()
                .withJobDefinition({
                    runType: 'parseInt'
                })
                .withRunHandler('parseInt', e =>
                    parseInt(e))
                .flatMap(event => event.split(','))
                .process("1,2,3,4")
                .should.deep.equal([1, 2, 3, 4])
        })

        it('all jobs run without triggers', () => {
            Limitless({
                jobDefinitions: [
                    {
                        runType: 'parseInt'
                    },
                    {
                        runType: 'addLetter'
                    }
                ], runHandlers: {
                    parseInt: e =>
                        e.split(',').map(el => parseInt(el)),
                    addLetter: e => "A" + e + "B"
                }
            }).process("1,2,3,4")
                .should.deep.equal([[1, 2, 3, 4], "A1,2,3,4B"])
        })

        it("don't run jobs without matching triggers if any trigger handlers are registered", () => {
            Limitless({
                jobDefinitions: [{
                    runType: 'parseInt'
                }], triggerHandlers: { wontBeRun: e => e }
            }).process("1,2,3,4")
                .should.deep.equal([])
        })

        it('triggered jobs run', () => {
            const jobDefinitions = [
                {
                    runType: 'parseInt', triggers: [{
                        type: "regex", definition: "\\d+"
                    }]
                }, {
                    runType: 'addLetter', triggers: [{
                        type: "regex", definition: "\\D+"
                    }]
                }
            ]
            Limitless({ jobDefinitions })
                .withRunHandler('parseInt', el => parseInt(el))
                .withRunHandler('addLetter', e => "A" + e + "B")
                .withTriggerHandler('regex', (definition, event) =>
                    event.match(new RegExp(definition)))
                .flatMap(event =>
                    event.split(','))
                .map(entry => entry.trim())
                .process("1 , C ,  , 2 , 3 , 4")
                .should.deep.equal([1, "ACB", 2, 3, 4])
        })

        describe('__identity', () => {
            it('returns input, included by default', () => {
                Limitless().withJobDefinition({
                    runType: "__identity"
                }).process("It Works")
                    .should.deep.equal(["It Works"])
            })
        })

        describe('__all', () => {
            it('defaults to true', () => {
                Limitless().withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: []
                    }]
                }).process(true)
                    .should.deep.equal([true])
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
