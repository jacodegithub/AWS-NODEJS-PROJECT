const SettingsModel = require("./../Models/SettingsModel")

class SettingsService {
    constructor() {
        this.SettingsModel = SettingsModel;
    };

    async checkInvoiceRequiredForInsurance() {
        try {
            const query = {key:"invoiceRequiredForInsurance"};
            const setting = await this.SettingsModel.findOne(query);
            const { value } = setting;
            return value;
        } catch (e) {
            console.error("SettingsService::isInvoiceRequiredForInsurance::Unhandled error", e);
            console.error(" Errors are ", e.errors)
            throw {
                "status": 500,
                "message": "Something went wrong while fetching InvoiceRequired setting."
            };
        };
    };

    async checkInvoiceRequiredForNonInsurance() {
        try {
            const query = {key:"invoiceRequiredForNonInsurance"};
            const setting = await this.SettingsModel.findOne(query);
            const { value } = setting;
            return value;
        } catch (e) {
            console.error("SettingsService::isInvoiceRequiredForNonInsurance::Unhandled error", e);
            console.error(" Errors are ", e.errors)
            throw {
                "status": 500,
                "message": "Something went wrong while fetching InvoiceRequired setting."
            };
        };
    };
}

module.exports = SettingsService;