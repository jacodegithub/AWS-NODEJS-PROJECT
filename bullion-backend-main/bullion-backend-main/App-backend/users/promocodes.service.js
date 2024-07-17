const PromoModel = require("../Models/PromoModel");

module.exports = { find, updateOne, add };

async function find(
  query,
  select = undefined,
  sort = undefined,
  skip = 0,
  limit = 100
) {
  try {
    return await PromoModel.find(query)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limit);
  } catch (e) {
    console.error("PromoService::find::Uncaught error", e);
    throw e;
  }
}

async function updateOne(updateId, updateQuery) {
  console.log(updateId, updateQuery);
  try {
    return await PromoModel.findOneAndUpdate(updateId, updateQuery);
  } catch (e) {
    console.error("PromoService::find::Uncaught error", e);
    throw e;
  }
}

async function add(data) {
  try {
    const promo = await PromoModel.create(data);
    promo.save();
    return promo;
  } catch (e) {
    console.error("PromoService::find::Uncaught error", e);
    throw {
      status: 500,
      message: e.message,
    };
  }
}
