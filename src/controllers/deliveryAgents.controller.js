import DeliveryAgent from "../../models/deliveryAgent.model.js";
import Order from "../../models/order.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { StatusCodes } from "http-status-codes";

function calculateNewRating(currentRating, newRating, deliveryCount) {
  return (currentRating * deliveryCount + newRating) / (deliveryCount + 1);
}

async function getLastMonthDeliveries(agentId) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const count = await DeliveryAgent.countDocuments({
    _id: agentId,
    orderHistory: {
      $elemMatch: {
        createdAt: { $gte: oneMonthAgo },
      },
    },
  });

  return count;
}

export const DeliveryAgentController = {
  // Core CRUD
  createDeliveryAgent: asyncHandler(async (req, res) => {
    const { agentId, name, phone, email, vehicleDetails } = req.body;

    if (!agentId || !name || !phone) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Agent ID, name and phone are required"
      );
    }

    const existingAgent = await DeliveryAgent.findOne({
      $or: [{ agentId }, { phone }, { email }],
    });

    if (existingAgent) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Agent with this ID, phone or email already exists"
      );
    }

    const agent = await DeliveryAgent.create({
      agentId,
      name,
      phone,
      email,
      vehicleDetails,
      currentLocation: req.body.currentLocation || undefined,
      isAvailable:
        req.body.isAvailable !== undefined ? req.body.isAvailable : true,
    });

    return ApiResponse.success(
      agent,
      "DeliveryAgent fetched successfully"
    ).send(res);
  }),

  getAllDeliveryAgents: asyncHandler(async (req, res) => {
    const { available, vehicleType, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (available) filter.isAvailable = available === "true";
    if (vehicleType) filter["vehicleDetails.type"] = vehicleType;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    };

    const agents = await DeliveryAgent.paginate(filter, options);

    return ApiResponse.success(
      agents,
      "All deliveryAgent fetched successfully"
    ).send(res);
  }),

  getDeliveryAgentById: asyncHandler(async (req, res) => {
    const { agentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid delivery agent ID");
    }

    const agent = await DeliveryAgent.findById(agentId)
      .populate("currentOrder", "orderId status")
      .populate("orderHistory", "orderId status createdAt");

    if (!agent) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery agent not found");
    }

    return ApiResponse.success(
      agent,
      "deliveryAgent fetched successfully"
    ).send(res);
  }),

  updateDeliveryAgent: asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid delivery agent ID");
    }

    const restrictedFields = [
      "agentId",
      "completedDeliveries",
      "rating",
      "orderHistory",
    ];
    restrictedFields.forEach((field) => delete updates[field]);

    if (updates.phone || updates.email) {
      const existingAgent = await DeliveryAgent.findOne({
        $and: [
          { _id: { $ne: agentId } },
          { $or: [{ phone: updates.phone }, { email: updates.email }] },
        ],
      });
      if (existingAgent) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Phone or email already in use by another agent"
        );
      }
    }

    const updatedAgent = await DeliveryAgent.findByIdAndUpdate(
      agentId,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedAgent) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery agent not found");
    }

    return ApiResponse.success(
      updatedAgent,
      "deliveryAgent updated successfully"
    ).send(res);
  }),

  deleteDeliveryAgent: asyncHandler(async (req, res) => {
    const { agentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid delivery agent ID");
    }

    const agent = await DeliveryAgent.findById(agentId);

    if (!agent) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Delivery agent not found");
    }

    if (agent.currentOrder) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Cannot delete agent with active delivery"
      );
    }

    await agent.deleteOne();

    return ApiResponse.success("deliveryAgent deleted successfully").send(res);
  }),

  // Availability
  toggleAvailability: asyncHandler(async (req, res) => {
    const { agentId } = req.params;

    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Delivery agent not found");
    }

    if (agent.currentOrder && !req.body.force) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Agent has an active order. Use force=true to override"
      );
    }

    agent.isAvailable = !agent.isAvailable;
    await agent.save();

    return ApiResponse.success("Toggle Availability delivery agents.").send(
      res
    );
  }),

  // Location
  updateLocation: asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Latitude and longitude are required"
      );
    }

    const agent = await DeliveryAgent.findByIdAndUpdate(
      agentId,
      { currentLocation: { lat, lng } },
      { new: true }
    );

    if (!agent) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Delivery agent not found");
    }

    return ApiResponse.success(agent, "Location updated successfully").send(
      res
    );
  }),

  // Orders
  assignCurrentOrder: asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { orderId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid order ID");
    }

    const [agent, order] = await Promise.all([
      DeliveryAgent.findById(agentId),
      Order.findById(orderId),
    ]);

    if (!agent)
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery agent not found");

    if (!order) throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");

    if (!agent.isAvailable) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Agent is not available for delivery"
      );
    }

    agent.currentOrder = orderId;
    agent.isAvailable = false;
    await agent.save();

    return ApiResponse.success(agent, "Order assigned successfully").send(res);
  }),

  completeCurrentOrder: asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { rating, feedback } = req.body;

    const agent = await DeliveryAgent.findById(agentId);
    if (!agent)
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery agent not found");
    if (!agent.currentOrder) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "No active order to complete"
      );
    }

    agent.orderHistory.push(agent.currentOrder);
    agent.completedDeliveries += 1;

    if (rating) {
      const newRating = calculateNewRating(
        agent.rating,
        rating,
        agent.completedDeliveries
      );
      agent.rating = newRating;
    }

    agent.currentOrder = null;
    agent.isAvailable = true;
    await agent.save();

    return ApiResponse.success(agent, "Order completed successfully").send(res);
  }),

  getOrderHistory: asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const agent = await DeliveryAgent.findById(agentId).populate({
      path: "orderHistory",
      options: {
        sort: { createdAt: -1 },
        skip: (page - 1) * limit,
        limit: parseInt(limit),
      },
    });

    if (!agent)
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery agent not found");

    return ApiResponse.success(
      agent.orderHistory,
      "Order history retrieved"
    ).send(res);
  }),

  // Stats and Ratings
  getAgentStats: asyncHandler(async (req, res) => {
    const { agentId } = req.params;

    const agent = await DeliveryAgent.findById(agentId).select(
      "completedDeliveries rating orderHistory"
    );

    if (!agent)
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery agent not found");

    const stats = {
      totalDeliveries: agent.completedDeliveries,
      averageRating: agent.rating.toFixed(1),
      currentOrder: agent.currentOrder ? true : false,
      lastMonthDeliveries: await getLastMonthDeliveries(agentId),
    };

    return ApiResponse.success("Agent statistics retrieved").send(res);
  }),

  updateRating: asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      throw new ApiError(400, "Rating must be between 1 and 5");
    }

    const agent = await DeliveryAgent.findById(agentId);
    if (!agent)
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery agent not found");

    const newRating = calculateNewRating(
      agent.rating,
      rating,
      agent.completedDeliveries
    );
    agent.rating = newRating;
    await agent.save();

    return ApiResponse.success(agent, "Rating updated successfully").send(res);
  }),

  // Bulk Operations
  bulkCreateDeliveryAgents: asyncHandler(async (req, res) => {
    const { agents } = req.body;

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Agents array is required");
    }

    const validationErrors = [];
    const validAgents = [];

    for (const agent of agents) {
      if (!agent.agentId || !agent.name || !agent.phone) {
        validationErrors.push(
          `Agent ${agents.indexOf(agent)} missing required fields`
        );
        continue;
      }
      validAgents.push(agent);
    }

    if (validationErrors.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Validation errors",
        validationErrors
      );
    }

    const createdAgents = await DeliveryAgent.insertMany(validAgents);

    return ApiResponse.success(createdAgents, "Agents created in bulk").send(
      res
    );
  }),

  bulkDeleteDeliveryAgents: asyncHandler(async (req, res) => {
    const { agentIds } = req.body;

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Agent IDs array is required"
      );
    }

    const agentsWithOrders = await DeliveryAgent.find({
      _id: { $in: agentIds },
      currentOrder: { $exists: true, $ne: null },
    });

    if (agentsWithOrders.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Some agents have active orders and cannot be deleted",
        {
          agentsWithOrders: agentsWithOrders.map((a) => a._id),
        }
      );
    }

    const result = await DeliveryAgent.deleteMany({ _id: { $in: agentIds } });

    return ApiResponse.success(result, "Agents deleted in bulk").send(res);
  }),

  // Filtering
  getAvailableDeliveryAgents: asyncHandler(async (req, res) => {
    const { vehicleType } = req.query;
    const filter = { isAvailable: true };

    if (vehicleType) filter["vehicleDetails.type"] = vehicleType;

    const agents = await DeliveryAgent.find(filter)
      .select("name phone vehicleDetails currentLocation rating")
      .sort({ rating: -1 });

    return ApiResponse.success(agents, "Available agents retrieved").send(res);
  }),

  getTopRatedDeliveryAgents: asyncHandler(async (req, res) => {
    const { limit = 5 } = req.query;

    const agents = await DeliveryAgent.find()
      .sort({ rating: -1, completedDeliveries: -1 })
      .limit(parseInt(limit))
      .select("name rating completedDeliveries vehicleDetails");

    return ApiResponse.success(agents, "Top rated agents retrieved").send(res);
  }),

  getNearbyDeliveryAgents: asyncHandler(async (req, res) => {
    const { lat, lng, radius = 5, limit = 10 } = req.query;

    if (!lat || !lng) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Latitude and longitude are required"
      );
    }

    const agents = await DeliveryAgent.find({
      isAvailable: true,
      currentLocation: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radius * 1000,
        },
      },
    })
      .limit(parseInt(limit))
      .select("name phone vehicleDetails currentLocation rating");

    return ApiResponse.success(agents, "Nearby agents retrieved").send(res);
  }),
};
