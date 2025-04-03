import Address from "../../models/address.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import ApiError from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";

export const AddressController = {
  createAddress: asyncHandler(async (req, res) => {
    const { street, city, state, postalCode, country } = req.body;

    if ([street, city, state, postalCode, country].some((field) => !field)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "All address fields (street, city, state, postalCode, country) are required"
      );
    }

    if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid postal code format");
    }

    const address = await Address.create({ ...req.body, user: req.user._id });

    const populatedAddress = await Address.findById(address._id).populate(
      "user",
      "name email"
    );
    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Address created successfully",
      data: {
        address: populatedAddress,
      },
    });
  }),

  getAllAddress: asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    if (req.query.isDefault) {
      filter.isDefault = req.query.isDefault === "true";
    }
    if (req.query.city) {
      filter.city = { $regex: req.query.city, $options: "i" };
    }

    const addresses = await Address.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const total = await Address.countDocuments(filter);

    return res.status(StatusCodes.OK).json({
      success: true,
      message:
        addresses.length > 0
          ? "Addresses fetched successfully"
          : "No addresses found",
      data: {
        addresses,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  getAddress: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid address ID format");
    }

    const address = await Address.findOne({
      _id: id,
      user: req.user._id,
    }).populate("user", "name email phone");

    if (!address) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Address not found or you don't have permission to access it"
      );
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Address fetched successfully",
      data: {
        address: {
          ...address.toObject(),
          formattedAddress: `${address.street}, ${address.city}, ${address.state} ${address.postalCode}`,
          user: {
            _id: address.user._id,
            name: address.user.name,
            email: address.user.email,
          },
        },
      },
    });
  }),

  updateAddress: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid address ID format");
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "No fields to update");
    }

    if (updateData.user) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Cannot change address ownership"
      );
    }

    const address = await Address.findByIdAndUpdate(
      {
        _id: id,
        user: req.user._id,
      },
      updateData,
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    ).populate("user", "name email");

    if (!address) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Address not found or you don't have permission to update it"
      );
    }

    if (updateData.isDefault === true) {
      await Address.updateMany(
        {
          user: req.user._id,
          _id: { $ne: address._id },
        },
        { $set: { isDefault: false } }
      );
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Address updated successfully",
      data: {
        address: {
          ...address.toObject(),
          formattedAddress: `${address.street}, ${address.city}, ${address.state} ${address.postalCode}`,
        },
      },
    });
  }),

  deleteAddress: asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid address ID format");
    }

    const address = await Address.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!address) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Address not found or you don't have permission to delete it"
      );
    }

    if (address.isDefault) {
      const remainingAddresses = await Address.find({
        user: req.user._id,
      }).sort({ createdAt: -1 });

      if (remainingAddresses.length > 0) {
        await Address.findByIdAndUpdate(remainingAddresses[0]._id, {
          isDefault: true,
        });
      }
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Address deleted successfully",
      data: {
        deletedAddress: {
          _id: address._id,
          street: address.street,
          city: address.city,
        },
      },
    });
  }),

  deleteManyAddress: asyncHandler(async (req, res) => {
    const filter = { user: req.user._id };

    if (req.user.role === "admin" && req.body.filter) {
      Object.assign(filter, req.body.filter);
    } else {
      if (Object.keys(req.body).length > 0) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "You don't have permission to use custom filters"
        );
      }
    }

    const result = await Address.deleteMany(filter);

    if (result.deletedCount === 0) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "No matching addresses found for deletion"
      );
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `${result.deletedCount} addresses deleted successfully`,
      data: {
        deletedCount: result.deletedCount,
        deletedAt: new Date(),
      },
    });
  }),

  updateSetDefaultAddress: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid address ID");
    }

    await Address.updateMany(
      { user: req.user._id, isDefault: true },
      { $set: { isDefault: false } }
    );

    const address = await Address.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { isDefault: true } },
      { new: true }
    );

    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Default address updated successfully",
      data: { address },
    });
  }),

  validateDefaultAddress: asyncHandler(async (req, res) => {
    const defaultAddress = await Address.findOne({
      user: req.user._id,
      isDefault: true,
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: defaultAddress
        ? "Default address exists"
        : "No default address set",
      data: {
        hasDefaultAddress: !!defaultAddress,
        defaultAddress: defaultAddress || null,
      },
    });
  }),

  nearByAddress: asyncHandler(async (req, res) => {
    const { longitude, latitude, maxDistance = 5000 } = req.query;

    if (!longitude || !latitude) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Longitude and latitude are required"
      );
    }

    const addresses = await Address.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
    }).limit(20);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `${addresses.length} nearby addresses found`,
      data: { addresses },
    });
  }),

  deliveryCheckAddress: asyncHandler(async (req, res) => {
    const { addressId } = req.params;

    const address = await Address.findById(addressId);

    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
    }

    const isDeliverable = await checkDeliveryService(address);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: isDeliverable
        ? "Address is deliverable"
        : "Delivery not available",
      data: {
        isDeliverable,
        estimatedDays: isDeliverable ? 2 : null,
      },
    });
  }),

  getAllAdminAddress: asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, "Admin access required");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.user = req.query.userId;
    if (req.query.city) filter.city = new RegExp(req.query.city, "i");

    const addresses = await Address.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("user", "name email");

    const total = await Address.countDocuments(filter);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Admin address list retrieved",
      data: { addresses },
      meta: { page, limit, total },
    });
  }),

  getAdminAddress: asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, "Admin access required");
    }

    const { id } = req.params;

    const address = await Address.findById(id).populate(
      "user",
      "name email phone"
    );

    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Admin address details retrieved",
      data: { address },
    });
  }),
};
