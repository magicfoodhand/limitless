const chai = require('chai')
chai.should();

const limitless = require("../src/limitless.js")
const Limitless = limitless.Limitless
const defaultFileHandler = limitless.defaultFileHandler

describe('Limitless', () => {
    describe('#process', () => {
        it('empty job', () => {
            Limitless.clear()
            Limitless.process("")
                .should.deep.equal([])
        })

        it('minimal job', () => {
            Limitless.clear()

            Limitless.withJobDefinition({
                runType: 'split'
            })
                .withRunHandler('split', event => event.split(','))
                .process("1,2,3,4")
                .should.deep.equal([["1", "2", "3", "4"]])
        })

        it('job - arguments', () => {
            Limitless.clear()

            Limitless.withJobDefinition({
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
            Limitless.clear()

            Limitless.withJobDefinition({
                runType: 'parseInt'
            })
                .withRunHandler('parseInt', e =>
                    e.map(el => parseInt(el)))
                .map(event => event.split(','))
                .process("1,2,3,4")
                .should.deep.equal([[1, 2, 3, 4]])
        })

        it('minimal job - flatMap', () => {
            Limitless.clear()

            Limitless.withJobDefinition({
                runType: 'parseInt'
            })
                .withRunHandler('parseInt', e =>
                    parseInt(e))
                .flatMap(event => event.split(','))
                .process("1,2,3,4")
                .should.deep.equal([1, 2, 3, 4])
        })

        it('all jobs run without triggers', () => {
            Limitless.clear()

            Limitless.withJobDefinition({
                runType: 'parseInt'
            }).withJobDefinition({
                runType: 'addLetter'
            })
                .withRunHandler('parseInt', e =>
                    e.split(',').map(el => parseInt(el)))
                .withRunHandler('addLetter', e =>
                    "A" + e + "B")
                .process("1,2,3,4")
                .should.deep.equal([[1, 2, 3, 4], "A1,2,3,4B"])
        })

        it('triggered jobs run', () => {
            Limitless.clear()

            Limitless.withJobDefinition({
                runType: 'parseInt', triggers: [{
                    type: "regex", definition: "\\d+"
                }]
            }).withJobDefinition({
                runType: 'addLetter', triggers: [{
                    type: "regex", definition: "\\D+"
                }]
            })
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
    })

    describe('#defaultFileHandler()', () => {
        it('should try to parse json - default', () => {
            const defaultValue = {
                config: {},
                jobs: [],
            }
            const value = defaultFileHandler("{}")
            defaultValue.should.deep.equal(value)
        })
    })
})
