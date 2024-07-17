const jwt = require('express-jwt');
// const secret = process.env.JWT_SECRET
const db = require('_helpers/db');
const Enums = require('../_helpers/Enums');

module.exports = authorizeTrader;

function authorizeTrader(roles = []) {
    // roles param can be a single role string (e.g. Role.User or 'User') 
    // or an array of roles (e.g. [Role.Admin, Role.User] or ['Admin', 'User'])
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return [
        // authenticate JWT token and attach user to request object (req.user)
        // jwt({ secret, algorithms: ['HS256'] }),


        // authorize based on user role
        async (req, res, next) => {
            const user = await db.Trader.findById(req.user.id);

            if (!user || (roles.length && !roles.includes(user.role))) {
                // user no longer exists or role not authorized
                return res.status(401).json({ message: `Unauthorized user=${user}` });
            }

            // authentication and authorization successful
            req.user = user;
            req.user.role = Enums.Roles.Trader;
            const refreshTokens = await db.RefreshToken.find({ user: user.id });
            req.user.ownsToken = token => !!refreshTokens.find(x => x.token === token);
            next();
        }
    ];
}
