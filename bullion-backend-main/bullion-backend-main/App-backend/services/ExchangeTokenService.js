const ExchangeTokenModel = require("./../Models/ExchangeTokenModel");
const NodeCache = require("node-cache");
const crypto = require("crypto");

const algorithm = "aes-256-cbc";
const securityKey = process.env.ENCRYPTION_SECURITY_KEY
const initVector = process.env.ENCRYPTION_INIT_VECTOR
const zerodhaCacheKey = "zerodhaAccessToken"
const cache = new NodeCache({ stdTTL: 0 });

const save = async (token) => {
    cache.set(zerodhaCacheKey, token);
    const cipher = crypto.createCipheriv(algorithm, securityKey, initVector);
    let encryptedData = cipher.update(token, "utf-8", "hex");
    encryptedData += cipher.final("hex");

    ExchangeTokenModel.create({ encryptedToken: encryptedData });
}

const saveEncrypted = async (encryptedToken) => {
    cache.del(zerodhaCacheKey)
    ExchangeTokenModel.create({ encryptedToken: encryptedToken });
}

const get = async () => {
    if (cache.has(zerodhaCacheKey)) {
        return cache.get(zerodhaCacheKey)
    }

    const token = await ExchangeTokenModel.findOne({}, {}, { sort: { created_at: -1 } });

    const decipher = crypto.createDecipheriv(algorithm, securityKey, initVector);
    let decryptedData = decipher.update(token.encryptedToken, "hex", "utf-8");
    decryptedData += decipher.final("utf8");

    cache.set(zerodhaCacheKey, decryptedData);
    return decryptedData;
}

module.exports = { save, get, saveEncrypted };
