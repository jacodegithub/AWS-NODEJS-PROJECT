const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const SchemaOptions = {
  timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
  }
};  

const LogsSchema = new Schema({
  name: String,
  estimate: {
	  userId: {
            type: Schema.Types.ObjectId,
            ref: "Users"
      },
      amount: Number
    },
}, SchemaOptions);

const LogsModel = mongoose.model("Logs", LogsSchema);
module.exports = LogsModel;
