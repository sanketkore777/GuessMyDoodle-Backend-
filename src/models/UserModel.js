const mongose = require("mongoose");

const UserAccountModel = new mongose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  nickname: {
    type: String,
    required: true,
    unique: true,
  },
  age: {
    type: Number,
    required: true,
  },
  points: {
    type: Number,
    default: 0,
  },
});

const User = mongose.model("users", UserAccountModel);
module.exports = User;
