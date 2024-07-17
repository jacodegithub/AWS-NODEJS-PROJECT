// Tookan service API

const Enums = require("./../_helpers/Enums");
const request = require("request");
const utils = require('./../_helpers/Utility');
const logger = require("../_helpers/logger");

class TookanService {
  constructor() {
    this.TOOKAN_BASE_URL = process.env.TOOKAN_BASEURL;
    this.TOOKAN_APIKEY = process.env.TOOKAN_APIKEY;
    this.TASK_CREATE_URL = `${this.TOOKAN_BASE_URL}/create_task`;
    this.TASK_EDIT_URL = `${this.TOOKAN_BASE_URL}/edit_task`;
    this.TASK_GET_URL = `${this.TOOKAN_BASE_URL}/get_job_details_by_order_id`;
    this.CANCEL_TASK = `${this.TOOKAN_BASE_URL}/cancel_task`;
    this.GET_AGENT_TAGS = `${this.TOOKAN_BASE_URL}/get_fleet_tags`;
    this.GET_AGENT_PROFILE = `${this.TOOKAN_BASE_URL}/view_fleet_profile`;
    this.GET_JOB_FROM_ORDER_ID = `${this.TOOKAN_BASE_URL}/get_job_details_by_order_id`;
    this.GET_FLEET_LOCATION = `${this.TOOKAN_BASE_URL}/get_fleet_location`;

    this.TOOKAN_TEAM = process.env.TOOKAN_TEAM;
    // this.BLR_REGULAR_TEAM = process.env.LOCUS_BLR_REGULAR_TEAM;
    // this.BLR_SECURE_AUTO_ACCEPT = process.env.LOCUS_BLR_SECURE_TEAM_AUTO_ACCEPT || true;
    // this.BLR_REGULAR_AUTO_ACCEPT = process.env.LOCUS_BLR_REGULAR_TEAM_AUTO_ACCEPT || false;

    // this.GET_CANCEL_TASK_URL = (taskId) => `${this.CANCEL_TASK}/${taskId}/status`;
  }

  formatDeliveryCostNotes(deliveryCosts = {}) {
    const tiers = deliveryCosts.hasOwnProperty("tiers")
      ? deliveryCosts["tiers"]
      : [];
    let items = [];

    tiers.map(({ amount }) => {
      //, bonus
      items.push({
        // item: label,
        item: `Earnings = ${amount}`,
        //\nBonus = ${bonus}\nTotal = ${amount + bonus}
        format: "TEXT",
      });
    });

    return items;
  }

  createTaskBody(savedOrder) {
    const startTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Calcutta",
    });
    let endTime;
    let maxDropTime;
    let teamId;
    let AUTO_ACCEPT;
    let AUTO_ASSIGN = 1;

    const {
      orderId,
      deliveryMethod,
      amount,
      currency,
      senderName,
      senderContact,
      senderFlat,
      senderBuilding,
      senderLocation,
      senderAdd,
      receiverName,
      receiverContact,
      receiverFlat,
      receiverBuilding,
      receiverLocation,
      receiverAdd,
      deliveryCosts,
      payment,
    } = savedOrder;

    const { paymentType, status, paymentNumber } = payment;
    const paymentMode =
      paymentType === Enums.PaymentType.postPay ? "PostPaid" : "PrePaid";

    const paymentStatus = (status === Enums.Razorpay.status.captured) ? "Paid" : status;

    let paymentLocation = "";

    if(paymentType === Enums.PaymentType.postPay){
      paymentLocation = (utils.phoneNumberFormatRazorPay(paymentNumber) === utils.phoneNumberFormatRazorPay(senderContact)) ? "Pickup" : "Drop";
    }

    logger.debug("paymentLocation: ",paymentLocation);
    
    const LINE_ITEM_ID = `${orderId}-line-item-1`;
    const LINE_ITEM_NAME = `Line Item 1 for order ID ${orderId}`;
    const LINE_ITEM_QUANTITY = 1;
    const CITY = "Bangalore";
    const COUNTRY_CODE = "IN";
    const TRANSACTION_DURATION = 60 * 5;
    const PICKUP_AMOUNT = 0;
    const PICKUP_ADDR = [senderFlat, senderBuilding, senderAdd].filter(c=> c !== "null" && c !== "undefined").filter(Boolean).join(", ");
    const DROP_ADDR = [receiverFlat, receiverBuilding, receiverAdd].filter(c=> c !== "null" && c !== "undefined").filter(Boolean).join(", ");
    const DROP_AMOUNT = 0;
    const PICK_UP_EXCHG_TYPE = "COLLECT";
    const DROP_EXCHG_TYPE = "GIVE";
    const VOL_VALUE = "1";
    const VOL_UNIT = "ITEM_COUNT";
    const TIMEZONE = -330;

    let deliveryNotes = [];

    if (deliveryMethod === Enums.DeliveryMethod.REGULAR) {
      teamId = this.TOOKAN_TEAM;
      endTime = new Date(Date.now() + 1000 * 3600 * 1.5);
      maxDropTime = new Date(Date.now() + 1000 * 3600 * 3);
      //AUTO_ACCEPT = this.BLR_REGULAR_AUTO_ACCEPT;
      deliveryNotes = this.formatDeliveryCostNotes(deliveryCosts);
    } else if (deliveryMethod === Enums.DeliveryMethod.SECURE) {
      // teamId = "blr-normal";
      teamId = this.TOOKAN_TEAM;
      endTime = new Date(Date.now() + 1000 * 3600 * 0.75);
      maxDropTime = new Date(Date.now() + 1000 * 3600 * 1.5);
      //AUTO_ACCEPT = this.BLR_SECURE_AUTO_ACCEPT;
    } else {
      logger.error(
        "TookanService::createTaskBody::Invalid delivery method = ",
        deliveryMethod
      );
      return reject({
        status: 400,
        message: "Unknown delivery method for order",
      });
    }

    //set teamId to "" if undefined
    if (!teamId) {
      teamId = "";
    }
    //if team is assigned, do not auto assign
    else {
      AUTO_ASSIGN = 0;
    }
    teamId = !teamId ? "" : teamId;

    endTime = endTime.toLocaleString("en-US", { timeZone: "Asia/Calcutta" });

    const tookanTask = {
      api_key: this.TOOKAN_APIKEY,
      order_id: orderId,
      job_description: "Pickup & Delivery", //get from UI if custom
      job_pickup_phone: senderContact,
      job_pickup_name: senderName,
      job_pickup_email: "",
      job_pickup_address: PICKUP_ADDR,
      job_pickup_latitude: senderLocation.lat,
      job_pickup_longitude: senderLocation.lng,
      job_pickup_datetime: startTime,
      customer_email: "",
      customer_username: receiverName,
      customer_phone: receiverContact,
      customer_address: DROP_ADDR,
      latitude: receiverLocation.lat,
      longitude: receiverLocation.lang,
      job_delivery_datetime: endTime,
      pickup_custom_field_template:"Pickup_And_Delivery",
      pickup_meta_data: [
        {
          label: "Payment_Mode",
          data: paymentMode,
        },
        {
          label: "Payment_Status",
          data: paymentStatus,
        },
        {
          label: "Amount",
          data: amount,
        },
        {
          label: "Payment_Location",
          data: paymentLocation,
        },
      ],
      custom_field_template: "Pickup_And_Delivery",
      meta_data: [
        {
          label: "Payment_Mode",
          data: paymentMode,
        },
        {
          label: "Payment_Status",
          data: paymentStatus,
        },
        {
          label: "Amount",
          data: amount,
        },
        {
          label: "Payment_Location",
          data: paymentLocation,
        },
      ],
      team_id: teamId,
      auto_assignment: AUTO_ASSIGN,
      has_pickup: "1",
      has_delivery: "1",
      layout_type: "0",
      tracking_link: 1,
      timezone: TIMEZONE, //can be set from UI
      fleet_id: "",
      // p_ref_images: [
      //   "http://tookanapp.com/wp-content/uploads/2015/11/logo_dark.png",
      //   "http://tookanapp.com/wp-content/uploads/2015/11/logo_dark.png",
      // ],
      // ref_images: [
      //   "http://tookanapp.com/wp-content/uploads/2015/11/logo_dark.png",
      //   "http://tookanapp.com/wp-content/uploads/2015/11/logo_dark.png",
      // ],
      notify: 1,
      tags: "",
      geofence: 0,
      ride_type: 0,
    };
    return tookanTask;
  }

  /**
   *
   * @param {*} savedOrder
   * @returns
   * - address
   * - checkLists
   * - creationTime
   * - eta
   * - orderDetail
   * - status
   * - statusUpdates
   * - taskGraph
   *      - visits<Array of 2 elements: Pickup and Drop>
   *          - [0] , [1]
   *              - trackLink
   */
  createTask(savedOrder) {
    return new Promise((resolve, reject) => {
      const { orderId } = savedOrder;
      // const TASK_CREATE_URL = `${this.TASK_CREATE_URL}/${orderId}-task-1`/${orderId}
      const TASK_CREATE_URL = `${this.TASK_CREATE_URL}`;
      const requestBody = {
        // auth: this.auth,
        body: this.createTaskBody(savedOrder),
        json: true,
      };

      request.post(
        TASK_CREATE_URL,
        requestBody,
        function (err, response, body) {
          if (err) {
            logger.error(
              "TookanService::createTask::Error attempting to create task for order = ",
              orderId
            );
            return reject(err);
          }

          if (response.statusCode !== 200) {
            logger.error(
              "TookanService::createTask::Failed to create task ",
              response.statusCode
            );
            return reject(response);
          }

          // logger.debug("TookanService::createTask::Task created successfully", response);
          resolve(body);
        }
      );
    });
  }

  updateTaskPaymentStatus(job_id, paymentMode, paymentStatus) {
    return new Promise((resolve, reject) => {
      const EditUrl = `${this.TASK_EDIT_URL}`;
      paymentMode = (paymentMode === Enums.PaymentType.postPay) ? "PostPaid" : "PrePaid";
      paymentStatus = (paymentStatus === Enums.Razorpay.status.captured) ? "Paid" : paymentStatus;
      const requestBody = {
        // auth: this.auth,
        body: {
          api_key: this.TOOKAN_APIKEY,
          job_id: job_id,
          custom_field_template: "Pickup_And_Delivery",
          meta_data: [
            {
                label: "Payment_Mode",
                data: paymentMode
            },
            {
                label: "Payment_Status",
                data: paymentStatus
            }
          ]
        },
        json: true,
      };
      request.post(
        EditUrl,
        requestBody,
        function (err, response, body) {
          if (err) {
            logger.error(
              "TookanService::updateTaskPaymentStatus::Error attempting to update task for order = ",
              orderId
            );
            return reject(err);
          }

          if (response.statusCode !== 200) {
            logger.error(
              "TookanService::updateTaskPaymentStatus::Failed to update task ",
              response.statusCode
            );
            return reject(response);
          }

          // logger.debug("TookanService::createTask::Task created successfully", response);
          resolve(body);
        }
      );
    });
  }

  getTaskBody(orderId) {
    const tookanGetTask = {
      api_key: this.TOOKAN_APIKEY,
      order_ids: [orderId],
      include_task_history: 0,
    };
    return tookanGetTask;
  }
  getTask(orderId) {
    return new Promise((resolve, reject) => {
      const GET_TASK_URL = `${this.TASK_GET_URL}`;
      const requestBody = {
        body: this.getTaskBody(orderId),
        json: true,
      };

      request.post(GET_TASK_URL, requestBody, function (error, response, body) {
        if (error) {
          logger.error(
            "TookanService::getTask::Error attempting to fetch task = ",
            taskId
          );
          return reject(err);
        }

        if (response.statusCode !== 200) {
          logger.error(
            "TookanService::getTask::Failed to fetch task ",
            response.statusCode
          );
          return reject(response);
        }

        // logger.debug("TookanService::getTask::Task fetched successfully", response);
        resolve(body);
      });
    });
  }

  getTrackLink(locusTask) {
    let response = { pickUpTrackLink: undefined, dropTrackLink: undefined };
    try {
      if (locusTask && locusTask.hasOwnProperty("data")) {
        response.pickUpTrackLink = locusTask.data.filter(
          (p) => p.job_type == 0
        )[0].tracking_link; //pickup track
        response.dropTrackLink = locusTask.data.filter(
          (p) => p.job_type == 1
        )[0].tracking_link; //drop track
      }
    } catch (e) {}

    return response;
  }

  cancelTaskBody(jobid) {
    const tookancancelTask = {
      api_key: this.TOOKAN_APIKEY,
      job_id: jobid,
      job_status: "9", // set jobstatus to 9 to cancel job
    };
    return tookancancelTask;
  }
  cancelPickupTask(jobid) {
    return new Promise((resolve, reject) => {
      const url = this.CANCEL_TASK;
      const requestBody = {
        body: this.cancelTaskBody(jobid),
        json: true,
      };

      request.post(url, requestBody, function (err, response, body) {
        if (err) {
          logger.error(
            "TookanService::cancelTask:: Failed to cancel task. Task ID = ",
            jobid
          );
          return reject(err);
        }

        if (response.statusCode !== 200) {
          logger.error(
            "TookanService::cancelTask:: Response failed with non-200 response",
            response.statusCode
          );
          return reject(err);
        }

        logger.debug(
          "TookanService::cancelTask:: Task cancelled successfully. Task ID = ",
          jobid
        );
        resolve(body);
      });
    });
  }
  cancelDeliveryTask(jobid) {
    return new Promise((resolve, reject) => {
      const url = this.CANCEL_TASK;
      const requestBody = {
        body: this.cancelTaskBody(jobid),
        json: true,
      };

      request.post(url, requestBody, function (err, response, body) {
        if (err) {
          logger.error(
            "TookanService::cancelTask:: Failed to cancel task. Task ID = ",
            jobid
          );
          return reject(err);
        }

        if (response.statusCode !== 200) {
          logger.error(
            "TookanService::cancelTask:: Response failed with non-200 response",
            response.statusCode
          );
          return reject(err);
        }

        logger.debug(
          "TookanService::cancelTask:: Task cancelled successfully. Task ID = ",
          jobid
        );
        resolve(body);
      });
    });
  }
  cancelTask(locusTask) {
    if (locusTask && locusTask.hasOwnProperty("data")) {
      const pickupJobId = locusTask.data.filter((p) => p.job_type == 0)[0]
        .job_id; //pickup job
      const deliveryJobId = locusTask.data.filter((p) => p.job_type == 1)[0]
        .job_id; //delivery job
      this.cancelPickupTask(pickupJobId);
      this.cancelDeliveryTask(deliveryJobId);
    }
  }
  //fleet_id is delivery agent id
  getAgentTags(fleet_id) {
    return new Promise((resolve, reject) => {
      const GET_TASK_URL = `${this.GET_AGENT_TAGS}`;
      const requestBody = {
        body: {
          api_key: this.TOOKAN_APIKEY,
          fleet_id: fleet_id,
        },
        json: true,
      };

      request.post(GET_TASK_URL, requestBody, function (error, response, body) {
        if (error) {
          logger.error(
            "TookanService::getAgentTags::Error attempting to fetch task = ",
            fleet_id
          );
          return reject(error);
        }

        if (response.statusCode !== 200) {
          logger.error(
            "TookanService::getAgentTags::Failed to fetch task ",
            response.statusCode
          );
          return reject(response);
        }

        // logger.debug("TookanService::getTask::Task fetched successfully", response);
        resolve(body);
      });
    });
  }
  getAgentProfile(fleet_id) {
    return new Promise((resolve, reject) => {
      const GET_TASK_URL = `${this.GET_AGENT_PROFILE}`;
      const requestBody = {
        body: {
          api_key: this.TOOKAN_APIKEY,
          fleet_id: fleet_id,
        },
        json: true,
      };

      request.post(GET_TASK_URL, requestBody, function (error, response, body) {
        if (error) {
          logger.error(
            "TookanService::getAgentProfile::Error attempting to fetch task = ",
            fleet_id
          );
          return reject(error);
        }

        if (response.statusCode !== 200) {
          logger.error(
            "TookanService::getAgentProfile::Failed to fetch task ",
            response.statusCode
          );
          return reject(response);
        }

        resolve(body);
      });
    });
  }
  //fleet_id is delivery agent id
  getTaskFromOrderId(orderId) {
    return new Promise((resolve, reject) => {
      const GET_JOB_URL = `${this.GET_JOB_FROM_ORDER_ID}`;
      const requestBody = {
        body: {
          api_key: this.TOOKAN_APIKEY,
          order_ids: [orderId],
          include_task_history: 0,
        },
        json: true,
      };

      request.post(GET_JOB_URL, requestBody, function (error, response, body) {
        if (error) {
          logger.error(
            "TookanService::getTaskFromOrderId::Error attempting to fetch task = ",
            orderId
          );
          return reject(error);
        }

        if (response.statusCode !== 200) {
          logger.error(
            "TookanService::getTaskFromOrderId::Failed to fetch task ",
            response.statusCode
          );
          return reject(response);
        } else {
          //check if body has data
          if (body.status !== 200) {
            logger.error(
              "TookanService::getAgentTags::Failed to fetch task ",
              response.statusCode
            );
            return reject(response);
          }
        }

        // logger.debug("TookanService::getTask::Task fetched successfully", response);
        resolve(body);
      });
    });
  }
  getAgentLocation(fleet_id) {
    return new Promise((resolve, reject) => {
      const GET_LOCATION_URL = `${this.GET_FLEET_LOCATION}`;
      const requestBody = {
        body: {
          api_key: this.TOOKAN_APIKEY,
          fleet_id: fleet_id,
        },
        json: true,
      };

      request.post(
        GET_LOCATION_URL,
        requestBody,
        function (error, response, body) {
          if (error) {
            logger.error(
              "TookanService::getAgentLocation::Error attempting to fetch task = ",
              fleet_id
            );
            return reject(error);
          }

          if (response.statusCode !== 200) {
            logger.error(
              "TookanService::getAgentLocation::Failed to fetch task ",
              response.statusCode
            );
            return reject(response);
          }

          // logger.debug("TookanService::getTask::Task fetched successfully", response);
          resolve(body);
        }
      );
    });
  }
}

module.exports = TookanService;
