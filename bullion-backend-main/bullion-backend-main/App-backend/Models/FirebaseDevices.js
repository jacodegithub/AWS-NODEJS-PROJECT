const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const schema = {
    /**
     * Map each user with their device
     */
    userId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    // deviceId: {
    //     type: Schema.Types.String,
    //     required: true
    // },
    devices: [{
        type: String,
        default: []
    }]
};

const mongooseOptions = {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
};

const FirebaseDevicesSchema = new Schema(schema, mongooseOptions);
FirebaseDevicesSchema.index({ "userId": 1})
const FirebaseDeviceModel = model('firebaseDevices', FirebaseDevicesSchema);

async function findOne(query) {
    try {
        return await FirebaseDeviceModel.findOne(query);
    } catch(error) {
        console.error("FirebaseDevices::findOne::uncaught error", error);
        throw error;
    }; 
};

async function upsert(userId, deviceId) {
    try {
        // newRecord = new FirebaseDeviceModel(newUserDevice);
        // document = await newRecord.save(); 
        return await FirebaseDeviceModel.updateOne(
            { userId }, 
            { "$addToSet": {"devices": deviceId }},
            { upsert: true }
        );
    } catch(error)  {
        console.error("FirebaseDevices::insert:: uncaught error", error);
        throw error;
    };
};

async function getUserAndDeviceID(userId, deviceId) {
    
    try {
        // Dont see the need for the below
        // const query = { userId, devices: deviceId }
        // userWithDeviceId = await findOne(query);
        // if (userWithDeviceId) {
        //     return { userId, deviceId };
        // };
        await upsert(userId, deviceId);
        return { userId, deviceId };
    } catch(error) {
        console.error("FirebaseDevices::getUserAndDeviceID:: uncaught error", error);
        throw error;
    }
};


module.exports = {
    findOne,
    getUserAndDeviceID
}

