const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SchemaOptions = {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
  };  
  const UserApiSchema = new Schema({
userId: {
    type: Schema.Types.ObjectId, 
    index: true,
    ref: "Users"
  },
  ApiKey:String
}
  ,SchemaOptions)
  const UserApiModel = mongoose.model("UserApiKey", UserApiSchema);
module.exports = UserApiModel;