const chai = require('chai')
chai.should();

const { Limitless } = require("../src/limitless");

describe('event modifiers', () => {
    it('map', () => {
        Limitless().withJobDefinition({
            runType: '__identity'
        }).map(el => parseInt(el))
            .process('1','2','3','4')
            .should.deep.equal([1, 2, 3, 4])
    })

    it('flatMap', () => {
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

    it('flatten', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .flatten()
            .process([1,2,3,4])
            .should.deep.equal([1, 2, 3, 4])
    })

    it('every', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .every(e => e % 2 === 0)
            .process(2,4,6,8)
            .should.deep.equal([true])
    })

    it('find', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .find(e => e % 2 === 0)
            .process(1,2,3,4)
            .should.deep.equal([2])
    })

    it('findIndex', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .findIndex(e => e % 4 === 0)
            .process(1,4,2,3)
            .should.deep.equal([1])
    })

    it('reduce', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .reduce((a, b) => a + b, 0)
            .process(1,2,3,4)
            .should.deep.equal([10])
    })

    it('reduceRight', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .reduceRight((a, b) => Math.pow(a + 1, b), 0)
            .process(1,2,3,4)
            .should.deep.equal([82])
    })

    it('some', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .some(e => e % 1 === 0)
            .process(1,4,3)
            .should.deep.equal([true])
    })

    it('pop', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .flatten()
            .pop()
            .process([1, 2, 3, 4])
            .should.deep.equal([1, 2, 3])
    })

    it('push', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .push(5, 6, 7)
            .process(1, 2, 3, 4)
            .should.deep.equal([1, 2, 3, 4, 5, 6, 7])
    })

    it('concat', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .concat([5], [6, 7])
            .flatten()
            .process([1, 2, 3, 4])
            .should.deep.equal([1, 2, 3, 4, 5, 6, 7])
    })

    it('shift', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .shift()
            .process(1, 2, 3, 4)
            .should.deep.equal([2, 3, 4])
    })

    it('unshift', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .unshift(-2, -1, 0)
            .process(1, 2, 3, 4)
            .should.deep.equal([-2, -1, 0, 1, 2, 3, 4])
    })

    it('sort', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .sort()
            .process(1,4,3)
            .should.deep.equal([1,3,4])
    })

    it('sort - compareFunction', () => {
        Limitless()
            .withJobDefinition({
                runType: '__identity'
            })
            .sort((a, b) => b - a)
            .process(1,4,3)
            .should.deep.equal([4,3,1])
    })
})