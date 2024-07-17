// const UserSegmentQueriesModel = require("../Models/UserSegmentQueriesModel");
const UserModel = require("../Models/UserModel");
const ObjectId = require('mongoose').Types.ObjectId;

async function getSegmentedUsers(queryTitle) {
  const parsedQueryTitle = queryTitle.toLowerCase();
  // await UserSegmentQueriesModel.findOne({ title: parsedQueryTitle });
  const userSegmentQuery = null;
  // What if there are a lot of users?
  const matcher = JSON.parse(userSegmentQuery.query)
  const users = await UserModel.aggregate([
    { $match: matcher },
    { $group: { _id: null, array: { $push: "$_id" } } },
    { $project: { array: true, _id: false } }
  ])
  return users
}

module.exports = {
  getSegmentedUsers
}
