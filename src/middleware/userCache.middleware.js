import redisClient from "../config/redis.config.js";

const cacheUserData =
  (expireInSeconds = 3600) =>
  async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) return next();

    const cacheKey = `user:${userId}`;

    try {
      const cachedUser = await redisClient.get(cacheKey);
      if (cachedUser) {
        req.user = { ...req.user, ...JSON.parse(cachedUser) };
        return next();
      }

      const originalJson = res.json;
      res.json = (data) => {
        if (data.success && data.data?.user) {
          redisClient.setEx(
            cacheKey,
            expireInSeconds,
            JSON.stringify(data.data.user)
          );
        }
        return originalJson.call(res, data);
      };

      next();
    } catch (error) {
      console.error("Caching error:", error);
      next();
    }
  };

export default cacheUserData;
