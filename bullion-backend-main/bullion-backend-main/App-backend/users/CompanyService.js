//const Enum = require('./../_helpers/Enums');
const CompanyModel = require("./../Models/CompanyModel");

class CompanyService {
  constructor() {
    this.companyModel = CompanyModel;
  }

  async findOne(query) {
    return await this.companyModel.findOne(query);
  }

  async updateOne(query, updateBody, options = {}) {
    return await this.companyModel.updateOne(query, updateBody, options);
  }

  async findOneAndUpdate(query, update, options = {}) {
    return await this.companyModel.findOneAndUpdate(query, update, options);
  }

  async create(newCompany) {
    try {
      const company = new CompanyModel(newCompany);
      await company.save();
      return company;
    } catch (e) {
      throw e;
    }
  }

  deductAmountFromWallet(amount, companyId) {
    if (companyId) {
      const query = { _id: companyId };
      const updateQuery = {
        $inc: { "paymentTypes.wallet.currentAmount": -amount },
      };

      this.updateOne(query, updateQuery).catch((err) => {
        console.error(
          "CompanyService::deductAmountFromWallet::Failed to process = ",
          companyId,
          "\n Error = ",
          err
        );
      });
    }
  }

  addMarginAmountInWallet(amount, companyId) {
    if (companyId) {
      const query = { _id: companyId };
      const updateQuery = {
        $inc: {
          "paymentTypes.wallet.currentAmount": -amount,
          "paymentTypes.wallet.marginAmount": amount,
        },
      };

      this.updateOne(query, updateQuery).catch((err) => {
        console.error(
          "CompanyService::addAmountInWallet::Failed to process = ",
          companyId,
          "\n Error = ",
          err
        );
      });
    }
  }
  removeMarginAmountFromWallet(amount, companyId) {
    if (companyId) {
      const query = { _id: companyId };
      const updateQuery = {
        $inc: {
          "paymentTypes.wallet.currentAmount": amount,
          "paymentTypes.wallet.marginAmount": -amount,
        },
      };

      this.updateOne(query, updateQuery).catch((err) => {
        console.error(
          "CompanyService::addAmountInWallet::Failed to process = ",
          companyId,
          "\n Error = ",
          err
        );
      });
    }
  }

  deductCreditAmount(amount, companyId) {
    if (companyId) {
      const query = { _id: companyId };
      const updateQuery = {
        $inc: { "paymentTypes.credit.currentCredit": -amount },
      };

      this.updateOne(query, updateQuery).catch((err) => {
        console.error(
          "CompanyService::deductCreditAmount::Failed to process = ",
          companyId,
          "\n Error = ",
          err
        );
      });
    }
  }

  addCreditAmount(amount, companyId) {
    if (companyId) {
      const query = { _id: companyId };
      const updateQuery = {
        $inc: { "paymentTypes.credit.currentCredit": amount },
      };

      this.updateOne(query, updateQuery).catch((err) => {
        console.error(
          "CompanyService::addCreditAmount::Failed to process = ",
          companyId,
          "\n Error = ",
          err
        );
      });
    }
  }
}

module.exports = CompanyService;
