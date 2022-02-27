import {Limitless, ArgumentRequest, TriggerRequest, LimitlessConfig, RunHandlerRequest} from './limitless'

describe('Limitless', () => {
    describe('process', () => {
        it('empty job', () => {
            expect(Limitless.create().process()).toEqual([])
        })

        it('empty job - ignores event', () => {
            expect(new Limitless().process('ignored')).toEqual([])
        })

        it('minimal job', () => {
            expect(new Limitless().withJobDefinition({
                runType: 'split'
            }).withRunHandler('split', ({args} : RunHandlerRequest) => (args as string).split(','))
                .process("1,2,3,4")).toEqual([["1", "2", "3", "4"]])
        })

        it('minimal job - multiple events', () => {
            expect(
                new Limitless().withJobDefinition({
                    runType: '__identity'
                }).process(1, 2, 3, 4)
            ).toEqual([1, 2, 3, 4])
        })

        it('multiple jobs', () => {
            const jobDefinitions = [{
                runType: 'split'
            }]
            const first = new Limitless({jobDefinitions})
                .withRunHandler('split', ({event} : RunHandlerRequest) => (event as string).split(','))

            const second = new Limitless({jobDefinitions})
                .withRunHandler('split', ({event} : RunHandlerRequest) => (event as string).split(',').map((e) => parseInt(e)))

            expect(first.process("1,2,3,4")).toEqual([["1", "2", "3", "4"]])
            expect(second.process("1,2,3,4")).toEqual([[1, 2, 3, 4]])
        })

        it('all jobs run without triggers', () => {
            expect(new Limitless({
                jobDefinitions: [
                    {runType: 'parseInt'},
                    {runType: 'addLetter'}
                ], runHandlers: {
                    parseInt: ({args: e}) =>
                        (e as string).split(',').map((el) => parseInt(el)),
                    addLetter: ({args: e}) => "A" + e + "B"
                }
            }).process("1,2,3,4")).toEqual([[1, 2, 3, 4], "A1,2,3,4B"])
        })
    })

    describe('arguments', () => {
        it('extract arguments from event', () => {
            expect(new Limitless().withJobDefinition({
                    runType: 'sum', arguments: [{
                        type: "extract"
                    }]
                })
                    .withRunHandler<Array<number>>('sum', ({args: values}) =>
                        values.reduce((a: number, b: number) => a + b, 0))
                    .withArgumentHandler('extract', ({event: element} : ArgumentRequest) =>
                        (element as Record<string, unknown>)['values'])
                    .process({values: [1, 2, 3, 4]})
            ).toEqual([10])
        })
    })

    describe('triggers', () => {
        it('triggered jobs run', () => {
            expect(new Limitless()
                .withJobDefinition({
                    runType: 'addLetter', triggers: [{
                        type: "__regex", definition: "\\D+"
                    }]
                })
                .withRunHandler('addLetter', ({event: e} : RunHandlerRequest) => "A" + e + "B")
                .process('1', 'C', '2', '3', '4')[0]
            ).toEqual("ACB")
        })

        it("don't run jobs without matching triggers if any trigger handlers are registered", () => {
            expect(new Limitless({
                pipelineDefinitions: [], argumentHandlers: {},
                jobDefinitions: [{
                    runType: 'parseInt'
                }], triggerHandlers: {wontBeRun: () => true}
            } as LimitlessConfig).process("1,2,3,4")).toEqual([])
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
            expect(new Limitless({jobDefinitions} as LimitlessConfig)
                .withRunHandler('parseInt', ({event: el}) => parseInt(el as string))
                .withTriggerHandler('regex', ({definition, event} : TriggerRequest<string>) => {
                    calls++
                    if(!event)
                        return false
                    const match = (event as string).match(new RegExp(definition ?? ''))
                    if(!match)
                        return false

                    return match.length > 0
                })
                .process("1")
            ).toEqual([1])
            expect(calls).toEqual(2)
        })
    })

    describe('run handlers', () => {

        const fromConfig = (config?: LimitlessConfig) => new Limitless(config).withJobDefinition({
            runType: "fromConfig"
        }).withRunHandler('fromConfig', (request: RunHandlerRequest) => {
            return request.config.value
        })

        describe('config', () => {
            it('can accept config', () => {
                expect(
                    fromConfig({
                        config: {
                            value: 'It Works!'
                        }
                    }).process("Don't forget calling `process` without any arguments results an empty list")
                ).toEqual(["It Works!"])
            })
        })

        describe('withConfig', () => {
            it('can accept config', () => {
                expect(
                    fromConfig()
                        .withConfig({value: 'It Works'})
                        .process("Don't forget calling `process` without any arguments results an empty list")
                ).toEqual(["It Works"])
            })
        })
    })

    describe('built in run handlers', () => {
        describe('__identity', () => {
            it('returns input', () => {
                expect(new Limitless().withJobDefinition({
                        runType: "__identity"
                    }).process("It Works")
                ).toEqual(["It Works"])
            })
        })

        describe('__toJson', () => {
            it('json as string', () => {
                expect(new Limitless().withJobDefinition({
                        runType: "__toJson"
                    }).process([1, 2, 3, 4])
                ).toEqual(["[1,2,3,4]"])
            })
        })
    })

    describe('built in argument handlers', () => {
        describe('__value', () => {
            it('uses value from definition', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {type: '__value', definition: 37}
                        ]
                    }).process('42')
                ).toEqual([37])
            })
        })

        describe('__env', () => {
            it('uses environment variable with name from definition', () => {
                process.env['test'] = 'meaning of life'
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {type: '__env', definition: 'test'}
                        ]
                    }).process('42')
                ).toEqual(['meaning of life'])
                process.env['test'] = ''
            })

            it('defaults to undefined', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {type: '__env', definition: 'unknown'}
                        ]
                    }).process('42')
                ).toEqual([undefined])
            })
        })

        describe('__positional', () => {
            it('uses handlers from definition', () => {
                process.env['myvalue'] = 'myvalue'
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {
                                type: '__positional',
                                definition: [
                                    {type: '__fromJson'},
                                    {type: '__env', definition: 'myvalue'}
                                ]
                            }
                        ]
                    }).process('{"testing": 42}')
                ).toEqual([[{"testing": 42}, 'myvalue']])
            })

            it('args are empty array if definition is missing', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {
                                type: '__positional'
                            }
                        ]
                    }).process('{"testing": 42}')
                ).toEqual([[]])
            })
        })


        describe('__keyword', () => {
            it('uses handlers from definition', () => {
                process.env['mykwvalue'] = 'testing'
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {
                                type: '__keyword',
                                definition: {
                                    meaningOfLife: {type: '__fromJson'},
                                    fromEnv: {type: '__env', definition: 'mykwvalue'}
                                }
                            }
                        ]
                    }).process('{"testing": 42}')
                ).toEqual([{
                    meaningOfLife: {"testing": 42},
                    fromEnv: 'testing'
                }])
            })


            it('args are empty object if definition is missing', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {
                                type: '__keyword'
                            }
                        ]
                    }).process('{"testing": 42}')
                ).toEqual([{}])
            })
        })

        describe('__fromJson', () => {
            it('converts input to JSON', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {type: '__fromJson'}
                        ]
                    }).process('[1,2,3,4]')
                ).toEqual([
                    [1, 2, 3, 4]
                ])
            })
        })

        describe('__fromRegex', () => {
            it('match groups are sent as args', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', arguments: [
                            {type: '__fromRegex', definition: "(\\d+),2,3,(\\d+)"}
                        ]
                    }).process('1,2,3,4')
                ).toEqual([
                    ['1', '4']
                ])
            })

            it('no match results in null', () => {
                expect(new Limitless().withJobDefinition({
                    runType: '__identity', arguments: [
                        {type: '__fromRegex', definition: "(\\d+),2,3,(\\d+)"}
                    ]
                }).process('hello')).toEqual([null])
            })
        })
    })

    describe('built in trigger handlers', () => {
        describe('__not', () => {
            it('defaults to false', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', triggers: [{
                            type: "__not"
                        }]
                    }).process(true)
                ).toEqual([])
            })

            it('inverts triggers', () => {
                expect(new Limitless()
                        .withTriggerHandler('isTruthy', ({event}) => event as boolean)
                        .withJobDefinition({
                            runType: '__identity',
                            triggers: [{
                                type: "__not",
                                definition: {
                                    type: 'isTruthy'
                                }
                            }]
                        })
                        .process(false)
                    // Trigger fired, return input
                ).toEqual([false])
            })
        })

        describe('__any', () => {
            it('does not run by default', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', triggers: [{
                            type: "__any", definition: []
                        }]
                    }).process(true)
                ).toEqual([])
            })

            it('does not run by default - no definition', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', triggers: [{
                            type: "__any"
                        }]
                    }).process(true)
                ).toEqual([])
            })

            it('requires any triggers to match', () => {
                const triggerHandlers = {
                    isPhoneNumber: ({event}: TriggerRequest<string | number>) =>
                        typeof event === 'string'
                        && event.match(/\d{3}-\d{3}-\d{4}/),
                    contains666: ({event}: TriggerRequest<string | number>) =>
                        event === 666
                        || typeof event === 'string'
                        && event.includes('666'),
                }
                const input = [
                    ['Name', 'Phone', 'Favorite Number'],
                    ['John Smith', '555-123-4567', 666],
                    ['Jane Smith', '503-555-4567', 2],
                    ['Bob Smith', '508-273-6667', 2]
                ]
                const limitless = new Limitless({triggerHandlers} as LimitlessConfig).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__any", definition: [
                            {type: "isPhoneNumber"},
                            {type: "contains666"}
                        ]
                    }]
                })
                expect(input.flatMap(value => value).flatMap(value =>
                    limitless.process(value)
                )).toEqual(['555-123-4567', 666, '503-555-4567', '508-273-6667'])
            })
        })

        describe('__all', () => {
            it('runs by default', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', triggers: [{
                            type: "__all", definition: []
                        }]
                    }).process(true)
                ).toEqual([true])
            })

            it('runs by default - no definition', () => {
                expect(new Limitless().withJobDefinition({
                        runType: '__identity', triggers: [{
                            type: "__all"
                        }]
                    }).process(true)
                ).toEqual([true])
            })

            it('fails unless all triggers match', () => {
                const triggerHandlers = {
                    isFalsy: ({event}: TriggerRequest) => !event,
                    isTruthy: ({event}: TriggerRequest) => event,
                }
                expect(new Limitless({triggerHandlers} as LimitlessConfig).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "isFalsy"},
                            {type: "isTruthy"}
                        ]
                    }]
                }).process(true)).toEqual([])
            })

            it('only runs triggers while value is truthy', () => {
                let i = 1
                const j = 1
                const triggerHandlers = {
                    'increment1': () => i++ && false,
                    'square4': () => false, // Not Run
                }
                expect(new Limitless({triggerHandlers} as LimitlessConfig).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "increment1"},
                            {type: "square4"},
                        ]
                    }]
                }).process(true)).toEqual([])
                expect(i).toEqual(2)
                expect(j).toEqual(1)
            })

            it('runs triggers in order', () => {
                let i = 1
                const triggerHandlers = {
                    'increment1': () => i === 1 && i++,
                    'double2': () => i === 2 && (i *= 2),
                    'square4': () => i === 4 && (i *= 4),
                }
                expect(new Limitless({triggerHandlers} as LimitlessConfig).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "increment1"},
                            {type: "double2"},
                            {type: "square4"}
                        ]
                    }]
                }).process(true)).toEqual([true])
                expect(i).toEqual(16)
            })

            it('requires all triggers to match', () => {
                const triggerHandlers = {
                    isString: ({event}: TriggerRequest) =>
                        typeof event === 'string',
                    isPhoneNumber: ({event}: TriggerRequest) =>
                        (event as string).match(/\d{3}-\d{3}-\d{4}/),
                    contains666: ({event}: TriggerRequest<string | number>) =>
                        (event as string).includes('666'),
                } as Record<string, unknown>

                const input = [['Name', 'Phone', 'Favorite Number'],
                    ['John Smith', '555-123-4567', 666],
                    ['Jane Smith', '503-555-4567', 2],
                    ['Bob Smith', '508-273-6667', 2]]

                const limitless = new Limitless({triggerHandlers} as LimitlessConfig).withJobDefinition({
                    runType: '__identity', triggers: [{
                        type: "__all", definition: [
                            {type: "isString"},
                            {type: "isPhoneNumber"},
                            {type: "contains666"}
                        ]
                    }]
                })
                expect(input.flatMap(e => e).flatMap(value =>
                    limitless.process(value))
                ).toEqual(['508-273-6667'])
            })
        })
    })

    describe('#pipeline', () => {
        it('triggered jobs run pipeline', () => {
            const config: LimitlessConfig = {
                jobDefinitions: [
                    {
                        runType: 'parseInt'
                    },
                    {
                        runType: 'convertInts', triggers: [{
                            type: "__regex", definition: "\\d+"
                        }]
                    }
                ], runHandlers: {
                    parseInt: ({event: el}: RunHandlerRequest) => parseInt(el as string),
                    convertInts: ({event: e}: RunHandlerRequest) => (e as string).trim().slice(1)
                }
            }

            const input: string[] = "A11, B24, C32, D42".split(',')
            const limitless = new Limitless(config).withPipeline({
                triggers: ["job-1"],
                steps: [
                    "job-0", // default job name
                ]
            })
            expect(input.flatMap(value => limitless.process(value))).toEqual([11, 24, 32, 42])
        })
    })
})
