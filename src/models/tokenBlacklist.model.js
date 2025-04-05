import mongoose from "mongoose";

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    unique: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["access", "refresh", "reset"],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "24h",
  },
});

const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

export default TokenBlacklist;
