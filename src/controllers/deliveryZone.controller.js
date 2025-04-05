/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */
import DeliveryZone from "../models/deliveryZone.model.js";
import Restaurant from "../models/restaurant.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { StatusCodes } from "http-status-codes";

export const DeliveryZoneController = {
  createDeliveryZone: asyncHandler(async (req, res) => {
    const { name, coordinates, deliveryFee, minOrderAmount } = req.body;

    if (!coordinates || coordinates.length < 3) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "At least 3 coordinates are required to create a zone"
      );
    }

    const deliveryZone = await DeliveryZone.create({
      name,
      coordinates,
      deliveryFee,
      minOrderAmount,
      createdBy: req.user._id,
    });

    return new ApiResponse(
      StatusCodes.CREATED,
      deliveryZone,
      "Delivery zone created successfully"
    ).send(res);
  }),

  getAllDeliveryZones: asyncHandler(async (req, res) => {
    const { activeOnly } = req.query;
    const filter = {};

    if (activeOnly === "true") filter.isActive = true;

    const zones = await DeliveryZone.find(filter).sort({ createdAt: -1 });

    return new ApiResponse(
      StatusCodes.OK,
      zones,
      "Delivery zones retrieved successfully"
    ).send(res);
  }),

  getDeliveryZoneById: asyncHandler(async (req, res) => {
    const { zoneId } = req.params;

    const zone = await DeliveryZone.findById(zoneId).populate(
      "restaurants",
      "name logo"
    );

    if (!zone) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery zone not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      zone,
      "Delivery zone retrieved successfully"
    ).send(res);
  }),

  updateDeliveryZone: asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    const updates = req.body;

    if (updates.coordinates && updates.coordinates.length < 3) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "At least 3 coordinates are required"
      );
    }

    const updatedZone = await DeliveryZone.findByIdAndUpdate(zoneId, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedZone) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery zone not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      updatedZone,
      "Delivery zone updated successfully"
    ).send(res);
  }),

  deleteDeliveryZone: asyncHandler(async (req, res) => {
    const { zoneId } = req.params;

    const zone = await DeliveryZone.findByIdAndDelete(zoneId);

    if (!zone) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery zone not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      null,
      "Delivery zone deleted successfully"
    ).send(res);
  }),

  // Status Management
  toggleZoneStatus: asyncHandler(async (req, res) => {
    const { zoneId } = req.params;

    const zone = await DeliveryZone.findById(zoneId);
    if (!zone) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Delivery zone not found");
    }

    zone.isActive = !zone.isActive;
    await zone.save();

    return new ApiResponse(
      StatusCodes.OK,
      zone,
      "Delivery zone status updated"
    ).send(res);
  }),

  // Restaurant Management
  addRestaurantsToZone: asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    const { restaurantIds } = req.body;

    const existingRestaurants = await Restaurant.countDocuments({
      _id: { $in: restaurantIds },
    });

    if (existingRestaurants !== restaurantIds.length) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Some restaurants not found");
    }

    const updatedZone = await DeliveryZone.findByIdAndUpdate(
      zoneId,
      { $addToSet: { restaurants: { $each: restaurantIds } } },
      { new: true }
    ).populate("restaurants", "name");

    return new ApiResponse(
      StatusCodes.OK,
      updatedZone,
      "Restaurants added to zone"
    ).send(res);
  }),

  removeRestaurantsFromZone: asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    const { restaurantIds } = req.body;

    const updatedZone = await DeliveryZone.findByIdAndUpdate(
      zoneId,
      { $pull: { restaurants: { $in: restaurantIds } } },
      { new: true }
    );

    return new ApiResponse(
      StatusCodes.OK,
      updatedZone,
      "Restaurants removed from zone"
    ).send(res);
  }),

  // Geo Operations
  checkLocationCoverage: asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Latitude and longitude are required"
      );
    }

    const zones = await DeliveryZone.find({
      coordinates: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      },
      isActive: true,
    });

    return new ApiResponse(
      StatusCodes.OK,
      zones,
      "Location coverage checked successfully"
    ).send(res);
  }),

  getNearbyZones: asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Latitude and longitude are required"
      );
    }

    const zones = await DeliveryZone.find({
      "coordinates.0": {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radius * 1000,
        },
      },
      isActive: true,
    }).select("name deliveryFee minOrderAmount estimatedDeliveryTime");

    return new ApiResponse(
      StatusCodes.OK,
      zones,
      "Nearby zones retrieved successfully"
    ).send(res);
  }),

  // Bulk Operations
  bulkCreateDeliveryZones: asyncHandler(async (req, res) => {
    const { zones } = req.body;

    if (!zones || !Array.isArray(zones)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Zones array is required");
    }

    const createdZones = await DeliveryZone.insertMany(zones);

    return new ApiResponse(
      StatusCodes.CREATED,
      createdZones,
      "Zones created in bulk"
    ).send(res);
  }),

  bulkDeleteDeliveryZones: asyncHandler(async (req, res) => {
    const { zoneIds } = req.body;

    if (!zoneIds || !Array.isArray(zoneIds)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Zone IDs array is required");
    }

    const result = await DeliveryZone.deleteMany({ _id: { $in: zoneIds } });

    return new ApiResponse(
      StatusCodes.OK,
      result,
      "Zones deleted in bulk"
    ).send(res);
  }),
};
