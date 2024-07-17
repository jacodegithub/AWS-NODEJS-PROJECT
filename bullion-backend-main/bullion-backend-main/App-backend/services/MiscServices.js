const { HttpStatusCode } = require('axios');
const DeviceVersions = require('./../Models/DeviceVersions');
const Enums = require('./../_helpers/Enums');

module.exports = class MiscServices {
    validateVersion(version) {
        if (typeof version !== 'string') {
            throw {
                status: 400,
                message: "Illegal or missing version"
            };
        };

        const [major, minor, patch, ...illegal] = version.split(".");
        // Ensure that version is of form X.Y.Z
        if ((Array.isArray(illegal) && illegal.length > 0) || (typeof illegal === 'string')) {
            console.info("MiscService::validateVersion::Invalid version = ", version);
            throw {
                status: 400,
                message: "Invalid version. Must follow semantic-versioning"
            };
        };

        if (Number.isNaN(Number(`${major}${minor}${patch}`))) {
            console.info("MiscService::validateVersion::Not a number");
            throw {
                status: 400,
                message: "Invalid version. Expecting numerical version"
            };
        };
    };

    compareVersions(v1, v2) {
        const [v1_maj, v1_min, v1_patch] = v1.split(".");
        const [v2_maj, v2_min, v2_patch] = v2.split(".");

        const versionOne = Number(`${v1_maj}${v1_min}${v1_patch}`);
        const versionTwo = Number(`${v2_maj}${v2_min}${v2_patch}`);

        if (versionOne > versionTwo) return 1;
        if (versionOne === versionTwo) return 0;
        return -1;
    };

    async isDeviceVersionSupported(device, requestVersion) {
        if (device !== Enums.Device.android && device !== Enums.Device.ios) {
            console.info("MiscService::isDeviceVersionSupported::Invalid device = ", device);
            throw {
                status: 400,
                message: "Invalid device type"
            };
        };
        this.validateVersion(requestVersion);

        const persistedVersion = await DeviceVersions.findOne({ device });
        if (!persistedVersion) {
            console.warn("MiscService::isDeviceVersionSupported::Could not fetch device version from DB = ", persistedVersion);
            throw {
                status: 500
            };
        };

        const { version, changesDescription } = persistedVersion;
        const { minimum, current } = version;

        // User's version MUST be equal or greater than minimum version
        if (this.compareVersions(requestVersion, minimum) < 0) {
            const response = {
                forceUpdate: true,
                optionalUpdate: false,
                changesDescription,
            };
            return { status: HttpStatusCode.Ok, data: response }
        };

        // OTOH, If current version is greater, you can offer
        // an option to update
        if (this.compareVersions(requestVersion, current) < 0) {
            const response = {
                forceUpdate: false,
                optionalUpdate: true,
                changesDescription
            };
            return { status: HttpStatusCode.Ok, data: response }
        };

        // return this if the app is on latest version
        return {
            status: HttpStatusCode.Ok, data: {
                forceUpdate: false,
                optionalUpdate: false
            }
        };
    };
};
