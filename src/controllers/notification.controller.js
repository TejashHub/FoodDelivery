import Notification from "../../models/Notification.model.js";
import User from "../../models/user.model.js";
import Order from "../../models/order.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";

export const NotificationController = {
  // Core Operations
  createNotification: asyncHandler(async (req, res) => {
    const {
      user,
      message,
      type,
      relatedOrder,
      deepLink,
      priority,
      expiryDate,
    } = req.body;

    if (!user || !message || !type) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Missing required fields: user, message, type"
      );
    }

    const userExists = await User.findById(user);
    if (!userExists) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (relatedOrder) {
      const orderExists = await Order.findById(relatedOrder);
      if (!orderExists) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Related order not found");
      }
    }

    if (expiryDate && new Date(expiryDate) <= new Date()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Expiry date must be in the future"
      );
    }

    const notification = await Notification.create({
      user,
      message: message.trim(),
      type,
      relatedOrder,
      deepLink: deepLink?.trim(),
      priority: priority || "medium",
      expiryDate: expiryDate || undefined,
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  }),

  getNotificationById: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid notification ID format"
      );
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Notification not found");
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Notification fetched successfully",
      data: notification,
    });
  }),

  getUserNotifications: asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const { type, priority, isRead, sortBy, page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID format");
    }

    const userExists = await User.exists({ _id: userId });

    if (!userExists) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const filter = { user: userId };
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (isRead) filter.isRead = isRead === "true";

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      high_priority: { priority: -1 },
      expiry: { expiryDate: 1 },
    };

    const sort = sortOptions[sortBy] || { createdAt: -1 };

    const skip = (page - 1) * limit;
    const countPromise = Notification.countDocuments(filter);

    const notificationsPromise = Notification.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("relatedOrder", "orderId status");

    const [total, notifications] = await Promise.all([
      countPromise,
      notificationsPromise,
    ]);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: notifications,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  updateNotification: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid notification ID format"
      );
    }

    const allowedUpdates = [
      "message",
      "type",
      "isRead",
      "deepLink",
      "priority",
      "expiryDate",
    ];

    const invalidUpdates = Object.keys(updates).filter(
      (field) => !allowedUpdates.includes(field)
    );

    if (invalidUpdates.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid update fields: ${invalidUpdates.join(", ")}`
      );
    }

    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedNotification) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Notification not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Notification updated successfully",
      data: updatedNotification,
    });
  }),

  deleteNotification: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid notification ID format"
      );
    }

    const deletedNotification = await Notification.findByIdAndDelete(id);

    if (!deletedNotification) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Notification not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Notification deleted successfully",
    });
  }),

  // Read Status Management
  markAsRead: asyncHandler(async (req, res) => {
    const { notificationId } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      res.status(404);
      throw new ApiError(StatusCodes.BAD_REQUEST, "Notification not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: { notification },
      message: "Notification deleted successfully",
    });
  }),

  markAllAsRead: asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(StatusCodes.OK).json({
      success: true,
      data: result.modifiedCount,
      message: "All Notification read successfully",
    });
  }),

  getUnreadCount: asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const count = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      total: count,
      message: "All Unread count successfully",
    });
  }),

  // Filtering & Bulk Operations
  getNotificationsByType: asyncHandler(async (req, res) => {
    const { userId, type } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const notifications = await Notification.find({
      user: userId,
      type,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(StatusCodes.OK).json({
      success: true,
      total: count,
      message: "Notification fetched successfully",
    });
  }),

  clearExpiredNotifications: asyncHandler(async (req, res) => {
    const count = await Notification.deleteMany({
      expiryDate: { $lte: new Date() },
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      total: count.deletedCount,
      message: "Notification deleted successfully",
    });
  }),

  getPriorityNotifications: asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { priority = "high" } = req.query;

    const notifications = await Notification.find({
      user: userId,
      priority,
      isRead: false,
    }).sort({ createdAt: -1 });

    return res.status(StatusCodes.OK).json({
      success: true,
      total: notifications.length,
      message: "Notification fetched priority successfully",
    });
  }),

  bulkSendNotifications: asyncHandler(async (req, res) => {
    const { userIds, message, type, priority = "medium", deepLink } = req.body;

    if (!userIds || !userIds.length || !message || !type) {
      throw ApiError(StatusCodes.BAD_REQUEST, "Missing required fields");
    }

    const notifications = userIds.map((userId) => ({
      user: userId,
      message,
      type,
      priority,
      ...(deepLink && { deepLink }),
    }));

    const result = await Notification.insertMany(notifications);

    return res.status(StatusCodes.OK).json({
      success: true,
      total: result.length,
      message: "Bulk notification Send successfully",
    });
  }),
};
