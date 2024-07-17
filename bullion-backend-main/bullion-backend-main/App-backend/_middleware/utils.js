const ServiceConfig = require("../Models/ServiceConfigModel");

function withinOperationalHours(service) {
    const currentDate = new Date();

    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    const operationTimes = service?.config?.operationTimes;
    if (operationTimes) {
        const { startMinutes, endMinutes } = service?.config?.operationTimes
        return (currentMinutes >= startMinutes && currentMinutes <= endMinutes)
    }
    return false
}

function withinOperationalDays(service) {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const currentDate = new Date();
    const today = days[currentDate.getDay()];

    return service?.config?.operationDays.includes(today);
}

async function isServiceable(serviceName) {
    const service = await ServiceConfig.findOne({ serviceName });
    return (service?.enabled && withinOperationalDays(service) && withinOperationalHours(service))
}

module.exports = { isServiceable }
