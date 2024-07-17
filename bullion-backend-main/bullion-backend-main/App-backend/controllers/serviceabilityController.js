const express = require("express");
const router = express.Router();
const checkServiceability = require("../_middleware/serviceability");

router.get("/serviceable/:serviceName", checkServiceability(), getStatus);


async function getStatus(_req, response, next) {
  try {
    return response.status(200).json({
      enabled: true,
    })
  }
  catch (error) {
    next(error);
  }
}

module.exports = router;
