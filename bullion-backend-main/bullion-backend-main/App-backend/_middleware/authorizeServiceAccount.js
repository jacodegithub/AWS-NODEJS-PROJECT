
const serviceAccountModel = require("../Models/ServiceAccountModel");


module.exports = authorizeService;

function authorizeService() {

    return [

        async (req, res, next) => {
            const serviceAccount = await serviceAccountModel.findOne({ apiKey: req.headers.authorization });
            if (serviceAccount && serviceAccount.enabled) {
                next();
            }
            else {
                return res.status(401).json({ message: `Service Unauthorized` });
            }
        }
    ];
}
