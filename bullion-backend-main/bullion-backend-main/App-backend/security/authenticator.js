const jwt = require('jsonwebtoken');
const RefreshToken = require('./../Models/refresh-token.model')

class Authenticator {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET;
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
        this.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_TOKEN_EXPIRY || "15m";
    };

    async findOneToken(query, fields) {
        try {
            return await RefreshToken.findOne(query, fields);
        } catch(e) {
            throw e;
        };
    };

    async removeToken(query) {
        return await RefreshToken.deleteOne(query);
    };

    generateJWTToken(payload, secret, options) {
        return jwt.sign(payload, secret, options)
    };

    decode(jwtToken, secret) {
        try {
            return jwt.verify(jwtToken, secret);
        } catch(e) {
            throw e;
        };
    };
    
    assertTokenIsValid(jwtToken) {
        // Can check validity of token
        return this.decode(jwtToken, this.JWT_REFRESH_SECRET);
    };

    async persistRefreshToken(payload) {
        try {
            const newRefreshToken = new RefreshToken(payload);
            return await newRefreshToken.save();
        } catch(e) {
            throw e;
        };
    };

    generateTokenPairs(userID) {
        // Generate access token and refresh token
        const payload = { sub: userID, id: userID };
        //const accessTokenOptions = { expiresIn: this.JWT_ACCESS_EXPIRY };
        const accessTokenOptions = { expiresIn: "7d" };

        const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
        const refreshTokenOptions = { expiresIn: "180d"};

        const accessToken = this.generateJWTToken(payload, this.JWT_SECRET, accessTokenOptions);
        const refreshToken = this.generateJWTToken(payload, this.JWT_REFRESH_SECRET, refreshTokenOptions);

        const refreshTokenData = { 
            user: userID, 
            token: refreshToken, 
            expires 
        }

        this.persistRefreshToken(refreshTokenData)
        .catch((e) => {});
        return { accessToken, refreshToken };
    };
};

module.exports = Authenticator;
