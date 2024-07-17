const { validateQuoteExpiry, validateChecksum, performPreOrderOperations } = require('../../services/BullionService')
const chai = require('chai')
const { assert, expect } = chai
const sinon = require('sinon')

const legitQuote = {
    itemId: "64afa6fd5d36f7a2c2c67d58",
    traderId: "64a69241b5d1794a4d8a7cec",
    quote: "73407",
    expiryTime: "2023-11-15T07:45:48.645Z",
    quoteUnitInGram: 10,
    checksum: "a0f6b9365c3f9e39fdc829fe22b785e6ff7e63bb8d72f20b71db8f586261e1f9"
}
const maliciousQuote = {
    itemId: "64afa6fd5d36f7a2c2c67d58",
    traderId: "64a69241b5d1794a4d8a7cec",
    quote: "70407",
    expiryTime: "2023-11-15T07:45:48.645Z",
    quoteUnitInGram: 10,
    checksum: "a0f6b9365c3f9e39fdc829fe22b785e6ff7e63bb8d72f20b71db8f586261e1f9"
}

const legitOrder = {
    ...legitQuote,
    quantity: 20
}

describe('validatQuote function', () => {
    it('should not throw exception if quote is valid and has not expired ', (done) => {
        const clock = sinon.useFakeTimers(new Date('2023-11-15T12:01:00Z'));
        const validQuote = { expiryTime: "2023-11-15T12:03:00Z" }
        assert.doesNotThrow(() => validateQuoteExpiry(validQuote))
        done();
        clock.restore();
    })

    it('throws exception when quote has expired', (done) => {
        const invalidQuote = { expiryTime: "2023-11-15T12:06:00Z" }
        assert.throws(() => validateQuoteExpiry(invalidQuote), 'Quote expired')
        done();
    })
})

describe('validateChecksum function', () => {

    it('checks if checksum is valid', (done) => {
        process.env.SECURITY_KEY = 'somethinsomethinsomethinsomethin'; // set secret for checksum calculation

        assert.isTrue(validateChecksum(legitQuote.itemId, legitQuote.traderId, legitQuote.quote, legitQuote.expiryTime, legitQuote.checksum))
        assert.isFalse(validateChecksum(maliciousQuote.itemId, maliciousQuote.traderId, maliciousQuote.quote, maliciousQuote.expiryTime, maliciousQuote.checksum))
        delete process.env.SECURITY_KEY;
        done();
    })

    it('throws error when secret is not defined', (done) => {
        assert.throws(() => validateChecksum(legitQuote.itemId, legitQuote.traderId, legitQuote.quote, legitQuote.expiryTime, legitQuote.checksum), 'Secret not found')
        done();
    })
})

describe('performPreOrderOperations function', () => {
    it('calculates amounts and creates order DTO', async () => {
        const clock = sinon.useFakeTimers(new Date('2023-11-15T12:05:00Z'));
        const stub = sinon.stub(Math, 'random').returns(0.5);
        const ordersDTO = {
            itemId: "64afa6fd5d36f7a2c2c67d58",
            traderId: "64a69241b5d1794a4d8a7cec",
            quote: "73407",
            expiryTime: "2023-11-15T07:45:48.645Z",
            quoteUnitInGram: 10,
            orderId: "bullion_1700049900001",
            checksum: "a0f6b9365c3f9e39fdc829fe22b785e6ff7e63bb8d72f20b71db8f586261e1f9",
            quantity: 20,
            bullionAmount: 146814,
            tcs: 0,
            totalAmount: 146814
        }
        const calculatedOrdersDTO = await performPreOrderOperations(legitOrder)
        expect(calculatedOrdersDTO).to.deep.equal(ordersDTO)
        clock.restore();
        stub.restore();
    })
})
