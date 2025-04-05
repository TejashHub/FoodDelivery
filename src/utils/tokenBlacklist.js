import TokenBlacklist from "../models/tokenBlacklist.model.js";

const blacklistToken = async (token, type, userId, ttlSeconds) => {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await TokenBlacklist.create({
    token: token,
    type: type,
    userId: userId,
    expiresAt: expiresAt,
  });
};

export default blacklistToken;
