const LogsModel = require("./../Models/LogsModel")

module.exports = {
    create
}

async function create(log) {
    try {
        const logs = new LogsModel(log);
        await logs.save();
        return logs;
    } catch (e) {
        console.error("LogsService::create::Unhandled error", e);
        console.error(" Errors are ", e.errors)
        throw {
            "status": 500,
            "message": "Something went wrong while saving logs."
        };
    };
};