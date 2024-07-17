const UserApiModel = require("./../Models/UserApiKeyModel");
//const User = require('./../Models/UserModel');
//const express = require("express");
//const db = require('_helpers/db');
// const genKey = () => {
//     //create a base-36 string that is always 30 chars long a-z0-9
//     // 'an0qrr5i9u0q4km27hv2hue3ywx3uu'
//     return [...Array(30)]
//       .map((e) => ((Math.random() * 36) | 0).toString(36))
//       .join('');
//   };

function validateKey (req, res, next)  {
  return [
  async (req, res, next) => {
    if (req!=undefined){
      let api_key = req.headers.apikey;
      const userApi = await UserApiModel.find({ ApiKey: api_key}); 
    if (userApi.length==1 && userApi[0].id!=undefined) {
      //good match
      req.userId = userApi[0].userId;
      next()
    } else {
      //stop and respond
      res.status(401).send({ error: { code: 401, message: 'You not allowed.' } });
    }
  }
}
  ];
}
   
    
  
  module.exports = {  validateKey };