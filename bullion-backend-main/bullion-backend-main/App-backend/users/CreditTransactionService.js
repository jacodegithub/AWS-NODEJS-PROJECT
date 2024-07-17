const CreditTransactionModel = require("../Models/CreditTransactionModel");
const CompanyModel = require("../Models/CreditTransactionModel");

class CreditTransactionService {
  constructor() {
    this.creditTransactionModel = CreditTransactionModel;
  }

  async findOne(query) {
    try {
      return await this.creditTransactionModel.findOne(query);
    } catch (e) {
      throw e;
    }
  }

  async count(query) {
    try {
      return await this.creditTransactionModel.countDocuments(query);
    } catch (e) {
      throw e;
    }
  }

  async updateOne(query, updateBody, options = {}) {
    try {
      return await this.creditTransactionModel.updateOne(
        query,
        updateBody,
        options
      );
    } catch (e) {
      throw e;
    }
  }

  async create(newCredit) {
    try {
      const credit = new CreditTransactionModel(newCredit);
      await credit.save();
      return credit;
    } catch (e) {
      throw e;
    }
  }
}

module.exports = CreditTransactionService;
