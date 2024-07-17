const { createHash } = require('crypto');

function generateChecksum(...args) {
    const checksumStr = args.join('')
    return createHash('sha256').update(checksumStr).digest('hex')
}

function generateQuoteChecksum(itemId, traderId, quote, expiryTime) {
    const secret = process.env.SECURITY_KEY;
    if (secret && secret.length > 0) {
        return generateChecksum(itemId, traderId, quote, expiryTime, secret)
    }
    throw new Error("Secret not found")
}

module.exports = { generateQuoteChecksum }
