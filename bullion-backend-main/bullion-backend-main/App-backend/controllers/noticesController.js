const express = require("express");
const router = express.Router();
const noticeModel = require('../Models/NoticeModel')
router.get("/:noticeName", getNotice);


async function getNotice(req, response, next) {
  try {
    const { noticeName } = req.params
    const notice = await noticeModel.findOne({ noticeName })
    return response.status(200).json({
      message: "Notice fetched successfully",
      data: notice
    })
  }
  catch (error) {
    next(error);
  }
}

module.exports = router;
