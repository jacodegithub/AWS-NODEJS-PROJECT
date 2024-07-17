const request = require("request");

class DeviceService {
  constructor() {
    this.DEVICE_TRAN_START_AUTH_KEY = process.env.DEVICE_TRAN_START_AUTH_KEY;
    this.DEVICE_GPS_AUTH_KEY = process.env.DEVICE_GPS_AUTH_KEY;
    this.DEVICE_API_URL = process.env.DEVICE_API_URL;
    this.TRANS_START_URL = `${this.DEVICE_API_URL}/api/TransactionStart`;
    this.DEVICE_LOCATION_URL = `${this.DEVICE_API_URL}/api/GPS/GetDeviceGpsLocation`;
  }
  getBoxIdFromTags(tags, startsWith) {
    try {
      const boxes = tags.filter((tag) => tag.toLowerCase().startsWith(startsWith));
      if(boxes.length > 1){
        throw {
          status: 404,
          message: "Agent is assigned with multiple devices.",
        };
      }
      const box = boxes[0];
      if (box) {
        const boxId = box.slice(startsWith.length);
        if (this.isNumeric(boxId)) {
          return boxId;
        } else {
          throw {
            status: 404,
            message: "Invalid BoxId",
          };
        }
      } else {
        throw {
          status: 404,
          message: "BoxId not found",
        };
      }
    } catch (e) {
      if (!e.hasOwnProperty("status")) {
        e.status = 404;
        e.message = "Error ";
      }
      throw { status: e.status, message: e.message };
    }
  }
  getNameFromProfile(profile) {
    try {
      const name = profile.data.fleet_details[0].first_name + " " + profile.data.fleet_details[0].last_name;
      return name;
    } catch (e) {
      if (!e.hasOwnProperty("status")) {
        e.status = 404;
        e.message = "Error ";
      }
      throw { status: e.status, message: e.message };
    }
  }
  getPhoneFromProfile(profile) {
    try {
      const phone = profile.data.fleet_details[0].phone;
      return phone;
    } catch (e) {
      if (!e.hasOwnProperty("status")) {
        e.status = 404;
        e.message = "Error ";
      }
      throw { status: e.status, message: e.message };
    }
  }
  addTimeInResponse(location,fleet_id){
    try{
      let date = new Date();
      date = date.toLocaleString('en-US', { timeZone: 'Asia/Calcutta' });
      //let response = location;
      const response = {data:[{...location.data[0], lastUpdated: date, riderId:fleet_id}]};
      return response;

    }catch(e){
      if (!e.hasOwnProperty("status")) {
        e.status = 404;
        e.message = "Error ";
      }
      throw { status: e.status, message: e.message };
    }
  }
  isNumeric(str) {
    if (typeof str != "string") return false; // we only process strings!
    return (
      !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
      !isNaN(parseFloat(str))
    ); // ...and ensure strings of whitespace fail
  }
  startDeviceTransaction(
    deviceNumber,
    orderId,
    senderContact,
    receiverContact
  ) {
    return new Promise((resolve, reject) => {
      const TRAN_START_URL = `${this.TRANS_START_URL}`;
      const requestBody = {
        body: {
          AuthKey: this.DEVICE_TRAN_START_AUTH_KEY,
          DeviceNumber: deviceNumber,
          OrderId: orderId,
          SenderContact: senderContact,
          ReceiverContact: receiverContact,
        },
        json: true,
      };

      request.post(
        TRAN_START_URL,
        requestBody,
        function (error, response, body) {
          if (error) {
            console.error(
              "startDeviceTransaction::Error starting transaction on device. ",
              error
            );
            return reject(error);
          }

          if (response.statusCode !== 200) {
            console.error(
              "startDeviceTransaction::Error from api " + response,
              response.statusCode
            );
            return reject(response);
          }

          // console.debug("TookanService::getTask::Task fetched successfully", response);
          resolve(body);
        }
      );
    });
  }
  getDeviceLocation(
    deviceNumber
  ) {
    return new Promise((resolve, reject) => {
      const DEVICE_LOCATION_URL = `${this.DEVICE_LOCATION_URL}?DeviceNo=${deviceNumber}&authkey=${this.DEVICE_GPS_AUTH_KEY}`;
      const options = {
        json: true,
      };
      request.get(
        DEVICE_LOCATION_URL,
        options,
        function (error, response, body) {
          if (error) {
            console.error(
              "getDeviceLocation::Error getting device data. ",
              error
            );
            return reject(error);
          }

          if (response.statusCode !== 200) {
            console.error(
              "getDeviceLocation::Error from api " + response,
              response.statusCode
            );
            return reject(response);
          }

          // console.debug("TookanService::getTask::Task fetched successfully", response);
          resolve(body);
        }
      );
    });
  }
}

module.exports = DeviceService;
