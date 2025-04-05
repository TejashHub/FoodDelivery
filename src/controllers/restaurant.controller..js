import mongoose from "mongoose";
import Restaurant from "../../models/restaurant.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import {
  cloudinaryFileUpload,
  cloudinaryFileRemove,
} from "../../utils/cloudinary.js";

const RestaurantController = {
  // Core Restaurant Operations
  createRestaurant: asyncHandler(async (req, res) => {
    const restaurantData = req.body;
    if (
      [
        restaurantData.name,
        restaurantData.owner,
        restaurantData.location,
        restaurantData.contact,
      ].some((field) => !field)
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Restaurant Name, Owner, Location, Contact are required."
      );
    }

    if (!restaurantData.slug) {
      restaurantData.slug = restaurantData.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");
    }

    const restaurant = await Restaurant.create(restaurantData);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Restaurant created successfully.",
      data: restaurant,
    });
  }),

  getAllRestaurants: asyncHandler(async (req, res) => {
    const {
      foodType,
      manager,
      owner,
      menu,
      name,
      contact,
      cuisineType,
      city,
      isPureVeg,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    const pageNumber = Math.max(1, parseInt(page)) | 1;
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit))) || 10;

    if (foodType) {
      filter.foodType = { $in: foodType.split(",").map((item) => item.trim()) };
    }

    if (manager) {
      if (!mongoose.Types.ObjectId.isValid(manager)) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Invalid manager ID format"
        );
      }
      filter.managers = manager;
    }

    if (owner) {
      if (!mongoose.Types.ObjectId.isValid(owner)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid owner ID format");
      }
      filter.owner = owner;
    }

    if (menu) {
      if (!mongoose.Types.ObjectId.isValid(menu)) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Invalid menu category ID format"
        );
      }
      filter["menu.category"] = menu;
    }

    if (name) {
      filter.$text = { $search: name };
    }

    if (contact) {
      const contactStr = contact.toString().trim();
      filter.$or = [
        { "contact.phone": { $regex: contactStr, $options: "i" } },
        { "contact.email": { $regex: contactStr, $options: "i" } },
      ];
    }

    if (cuisineType) {
      filter.cuisineType = {
        $in: cuisineType.split(",").map((item) => item.trim()),
      };
    }

    if (city) {
      filter["location.city"] = { $regex: city, $options: "i" };
    }

    if (isPureVeg !== undefined) {
      filter.isPureVeg = isPureVeg === "true";
    }

    let sortOptions = {};
    if (sort) {
      sort.split(",").forEach((field) => {
        const [key, value] = field.split(":");
        if (key && (value === "asc" || value === "desc")) {
          sortOptions[key] = value === "desc" ? -1 : 1;
        }
      });
    }

    if (Object.keys(sortOptions).length === 0) {
      sortOptions.createdAt = -1;
    }

    const [restaurants, total] = await Promise.all([
      Restaurant.find(filter)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .sort(sortOptions)
        .populate("owner", "name email")
        .populate("managers", "name email")
        .populate("menu.category", "name")
        .populate("menu.items", "name price"),
      Restaurant.countDocuments(filter),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Restaurant fetched successfully",
      count: restaurants.length,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      data: restaurants,
    });
  }),

  getRestaurant: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { slug: id };

    const restaurant = await Restaurant.findOne(query)
      .populate("owner", "name email")
      .populate("managers", "name email")
      .populate("menu.category", "name")
      .populate("menu.items", "name price description");

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    restaurant.viewCount += 1;
    await restaurant.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Restaurant fetched succesfully,",
      data: restaurant,
    });
  }),

  updateRestaurant: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restaurantData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid restaurant ID");
    }

    if (restaurantData.name) {
      restaurantData.slug = restaurantData.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      restaurantData,
      { new: true, runValidators: true }
    )
      .populate("owner", "name email")
      .populate("managers", "name email");

    if (!updatedRestaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Restaurant updated successfully",
      data: updatedRestaurant,
    });
  }),

  deleteRestaurant: asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid restaurant ID");
    }

    const DeleteRestaurant = await Restaurant.findByIdAndDelete(id);

    if (!DeleteRestaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: DeleteRestaurant,
    });
  }),

  deleteManyRestaurants: asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Please provide an array of restaurant IDs"
      );
    }

    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));

    if (invalidIds.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid restaurant IDs: ${invalidIds.join(", ")}`
      );
    }

    const restaurant = await Restaurant.deleteMany({
      _id: { $in: ids },
    });

    if (restaurant.total === 0) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "No restaurants found to delete"
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        success: true,
        message: "Restaurants deleted Successfully,",
        total: restaurant.total,
      },
    });
  }),

  // Location-Based Operations
  getNearbyRestaurants: asyncHandler(async (req, res) => {
    const { longitude, latitude, distance = 500 } = req.body;
    if (!longitude || !latitude) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Longitude and latitude are required"
      );
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);
    const maxDistance = parseInt(distance);

    if (isNaN(lng) || lng < -180 || lng > 180) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid longitude value");
    }

    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid latitude value");
    }

    if (isNaN(maxDistance) || maxDistance <= 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid distance value");
    }

    const restaurants = await Restaurant.find({
      "location.geoLocation": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: maxDistance,
        },
      },
    })
      .populate("owner", "name email")
      .populate("menu.category", "name");

    res.status(StatusCodes.OK).json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  }),

  getCityRestaurants: asyncHandler(async (req, res) => {
    const { city, page = 1, limit = 10 } = req.query;

    if (!city) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "City name is required");
    }

    const pageNumber = Math.max(1, parseInt(page) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit))) || 10;

    const [restaurants, total] = await Promise.all([
      Restaurant.find({
        "location.city": new RegExp(city, "i"),
      })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .populate("owner", "name email")
        .populate("menu.category", "name"),
      Restaurant.countDocuments({ "location.city": new RegExp(city, "i") }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Your city got successfully",
      count: restaurants.length,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      data: restaurants,
    });
  }),

  getZoneRestaurants: asyncHandler(async (req, res) => {
    const { zoneId, page = 1, limit = 10 } = req.body;

    if (!zoneId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid zone ID required");
    }

    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid zone ID formate");
    }

    const pageNumber = Math.max(1, parseInt(page)) || 1;
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit))) || 10;

    const [restaurants, total] = await Promise.all(
      Restaurant.find({
        "location.zoneId": zoneId,
      })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .populate("owner", "name email")
        .populate("menu.category", "name")
        .populate("location.zoneId", "name"),
      Restaurant.countDocuments({ "location.zoneId": zoneId })
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Your restaurant zone is fetched successfully",
      count: restaurants.length,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      data: restaurants,
    });
  }),

  // Status & Availability
  getRestaurantStatus: asyncHandler(async (req, res) => {
    const { id } = req.body;

    const restaurant = await Restaurant.findById(id).select(
      "isOpenNow isActive isBusy isAcceptingOrders openingHours holidays"
    );

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    const now = new Date();
    const currentDay = now.toLocaleString("en-US", { weekday: "long" });
    const currentTime = now.toTimeString().substring(0, 5);

    const todayHours = restaurant.openingHours.find(
      (hours) => hours.day === currentDay
    );

    const isHoliday = restaurant.holidays.some(
      (holiday) => holiday.toDateString() === now.toDateString()
    );

    let shouldBeOpen = false;

    if (todayHours && !todayHours.isClosed && !isHoliday) {
      shouldBeOpen =
        currentTime >= todayHours.open && currentTime <= todayHours.close;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Your restaurant status got successfully",
      data: {
        isOpenNow: restaurant.isOpenNow,
        isActive: restaurant.isActive,
        isBusy: restaurant.isBusy,
        isAcceptingOrders: restaurant.isAcceptingOrders,
        shouldBeOpen: shouldBeOpen,
        isHoliday: isHoliday,
        todayHours: todayHours,
        nextHoliday: restaurant.holidays.find((h) => h > now),
      },
    });
  }),

  isRestaurantOpen: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).select(
      "isOpenNow openingHours holidays"
    );

    if (!restaurant) {
      throw new ApiError(StatusCodes.BAD_GATEWAY, "Restaurant not found");
    }

    const now = new Date();
    const currentDay = now.toLocaleString("en-us", { weekday: "long" });
    const currentTime = now.toTimeString().substring(0, 5);
    const todayHours = restaurant.openingHours.find(
      (hours) => hours.day === currentDay
    );
    const isHoliday = restaurant.holidays.some(
      (holiday) => holiday.toDateString() === now.toDateString()
    );

    let isOpen = false;

    if (todayHours && !todayHours.isClosed && !isHoliday) {
      isOpen =
        currentTime >= todayHours.open && currentTime <= todayHours.close;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Your restaurant current status fetched successfully",
      data: {
        isOpen: isOpen && restaurant.isOpenNow,
        manualOverride: restaurant.isOpenNow !== isOpen,
        currentTime: currentTime,
        todayHours: todayHours,
        isHoliday: isHoliday,
      },
    });
  }),

  updateRestaurantOpeningHours: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { openingHours } = req.body;

    if (!Array.isArray(openingHours)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Opening hours must be an array"
      );
    }

    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    const validateHourse = openingHours.map((hour) => {
      if (!days.includes(hour.day)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid day ${hour.day}`);
      }
      if (
        !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hour.open) ||
        !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hour.close)
      ) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Time format should be HH:MM in 24-hour format"
        );
      }
      return {
        day: hour.day,
        open: hour.open,
        close: hour.close,
        isClosed: hour.isClosed || false,
      };
    });

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        openingHours: validateHourse,
      },
      { new: true, runValidators: true }
    ).select("openingHours");

    if (!updatedRestaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Opening hours updated successfully",
      data: updatedRestaurant.openingHours,
    });
  }),

  updateRestaurantHolidays: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { holidays } = req.body;

    if (!Array.isArray(holidays)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Holidays must be an array of dates"
      );
    }

    const validateHolidays = holidays.map((holiday) => {
      const date = new Date(dateString);
      if (NaN(date.getTime())) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `Invalid date: ${dateString}`
        );
      }
      return date;
    });

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        holidays: validateHolidays,
      },
      { new: true }
    ).select("holidays");

    if (!updatedRestaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Holidays updated successfully",
      data: updatedRestaurant.holidays.map(
        (d) => d.toISOString().split("T")[0]
      ),
    });
  }),

  // Menu Management
  getRestaurantMenu: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id)
      .populate({ path: "menu.category", select: "menu.description" })
      .populate({
        path: "menu.items",
        select: "name description price image isVegetarian isVegan",
        populate: {
          path: "category",
          select: "name",
        },
      });

    if (!restaurant) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Menu fetched successfully",
      data: restaurant.menu,
    });
  }),

  createRestaurantMenu: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { category, items } = req.body;

    if (!category || !items || !Array.isArray(items)) {
      throw new ApiError("Category and items array are required.");
    }

    const categoryExists = mongoose
      .model("MenuCategory")
      .exists({ _id: category });

    if (!categoryExists) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid menu category");
    }

    const validItems = await mongoose
      .model("MenuItem")
      .countDocuments({ _id: { $in: items } });

    if (!validItems) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Some menu items are invalid"
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        $push: {
          menu: {
            category: true,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!restaurant) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant not found");
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Menu section added successfully",
      data: restaurant.menu,
    });
  }),

  createMultipleRestaurantMenus: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { menus } = req.body;

    if (!Array.isArray(menus)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Menus must be an array of {category, items} objects"
      );
    }

    const categoryId = menus.map((m) => m.category);
    const itemIds = menus.map((m) => m.items);

    const [validCategories, validItems] = await Promise.all([
      mongoose
        .model("MenuCategory")
        .countDocuments({ _id: { $in: categoryId } }),

      mongoose.model("MenuItem").countDocuments({ _id: { $in: itemIds } }),
    ]);

    if (validCategories !== categoryIds.length) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Some menu categories are invalid"
      );
    }
    if (validItems !== itemIds.length) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Some menu items are invalid"
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        $push: { menu: { $each: menus } },
      },
      { new: true, runValidators: true }
    ).select("menu");

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: `${menus.length} menu sections added successfully`,
      data: restaurant.menu,
    });
  }),

  updateRestaurantMenu: asyncHandler(async (req, res) => {
    const { id, menuId } = req.params;
    const { category, items } = req.body;

    if (!category || !items) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Provide either category or items to update"
      );
    }

    const updateData = {};

    if (category) {
      const categoryExists = await mongoose
        .model("MenuCategory")
        .exists({ _id: category });
      if (!categoryExists) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid menu category");
      }
      updateData["menu.$.category"] = category;
    }

    if (items) {
      if (!Array.isArray(items)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Items must be an array");
      }

      const validItems = await mongoose
        .model("MenuItem")
        .countDocuments({ _id: { $in: items } });

      if (validItems !== items.length) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Some menu items are invalid"
        );
      }
      updateData["menu.$.items"] = items;
    }

    const restaurant = await Restaurant.findOneAndUpdate(
      { _id: id, "menu._id": menuId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("menu");

    if (!restaurant) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Restaurant or menu section not found"
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Menu section updated successfully",
      data: restaurant.menu.find((m) => m._id.toString() === menuId),
    });
  }),

  deleteRestaurantMenu: asyncHandler(async (req, res) => {
    const { id, menuId } = req.params;

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        $pull: {
          menu: {
            _id: menuId,
          },
        },
      },
      {
        new: true,
      }
    );

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Menu section deleted successfully",
      data: restaurant.menu,
    });
  }),

  // Media Management
  updateRestaurantLogo: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const logoPathfile = req?.file;

    if (!logoPathfile) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Logo image is required");
    }

    const logo = await cloudinaryFileUpload(logoPathfile);

    if (!logo) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Error uploading logo image to Cloudinary."
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        $push: {
          url: logo.url,
          caption: "Restaurant Logo",
          publicId: logo.public_id,
        },
      },
      { new: true }
    ).select(logo);

    if (!restaurant) {
      await cloudinaryFileRemove(logo.public_id);
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Logo updated successfully",
      data: { logo: restaurant.logo },
    });
  }),

  updateRestaurantCoverImage: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const coverImageFilePath = req?.file;

    if (!coverImageFilePath) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Cover image is required");
    }

    const coverImage = await cloudinaryFileUpload(coverImageFilePath);

    if (!coverImageFilePath) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Error uploading cover image to Cloudinary"
      );
    }

    const current = await Restaurant.findById(id).select("coverImagePublicId");
    if (current?.coverImagePublicId) {
      await cloudinaryFileRemove(current.coverImagePublicId).catch(
        console.error
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        coverImage: coverImage.url,
        coverImagePublicId: coverImage.public_id,
        $push: {
          images: {
            url: coverImage.url,
            caption: "Restaurant Cover",
            publicId: coverImage.public_id,
          },
        },
      },
      { new: true }
    ).select("coverImage");

    if (!restaurant) {
      await cloudinaryFileRemove(coverImage.public_id);
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Cover image updated successfully",
      data: { coverImage: restaurant.coverImage },
    });
  }),

  addRestaurantGalleryImage: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { caption, isFeatured = false } = req.body;

    const gallaryImageFilePath = req?.file;

    if (!gallaryImageFilePath) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Cover image is required");
    }

    const gallaryImage = await cloudinaryFileUpload(gallaryImageFilePath);

    if (!gallaryImage) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Error uploading logo image to Cloudinary"
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        $push: {
          images: {
            url: gallaryImage.url,
            caption: caption || "",
            isFeatured,
            publicId: gallaryImage.public_id,
          },
        },
      },
      { new: true }
    ).select("images");

    if (!restaurant) {
      await cloudinaryFileRemove(gallaryImage.public_id);
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    const addedImage = restaurant.images.find(
      (img) => img.publicId === result.public_id
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Image added to gallery successfully.",
      data: addedImage,
    });
  }),

  deleteRestaurantImage: asyncHandler(async (req, res) => {
    const { id, imageId } = req.params;

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $pull: { images: { _id: imageId } } },
      { new: true }
    ).select("images");

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Image deleted successfully",
      data: {
        deletedCount: 1,
        remainingImages: restaurant.images.length,
      },
    });
  }),

  // Delivery & Order Management
  updateDeliveryOptions: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: { deliveryDetails: updateData } },
      { new: true }
    ).select(deliveryDetails);

    if (!restaurant) {
      res.status(404);
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.json({
      success: true,
      message: "Delivery options updated successfully",
      data: restaurant.deliveryDetails,
    });
  }),

  getDeliveryOptions: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).select("deliveryDetails");

    if (!restaurant) {
      res.status(404);
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.json({
      success: true,
      message: "Delivery options fetched successfully",
      data: restaurant.deliveryDetails,
    });
  }),

  createDeliveryTimeSlot: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { startTime, endTime, maxOrders } = req.body;

    if (!startTime || !endTime) {
      res.status(400);
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Start time and end time are required"
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        $push: {
          "deliveryDetails.deliverySlots": {
            startTime,
            endTime,
            maxOrders: maxOrders || 0,
          },
        },
      },
      { new: true }
    ).select("deliveryDetails.deliverySlots");

    if (!restaurant) {
      res.status(404);
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(201).json({
      success: true,
      message: "Delivery time slot created successfully",
      data: restaurant.deliveryDetails.deliverySlots,
    });
  }),

  getDeliveryTimeSlots: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).select(
      "deliveryDetails.deliverySlots"
    );

    if (!restaurant) {
      res.status(404);
      throw new Error("Restaurant not found");
    }

    res.json({
      success: true,
      data: restaurant.deliveryDetails.deliverySlots,
    });
  }),

  // Offers & Promotions
  createRestaurantOffer: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const {
      title,
      description,
      code,
      discountType,
      discountValue,
      minOrderAmount,
      validTill,
    } = req.body;

    if (
      [title, discountType, discountValue, validTill].some((field) => !field)
    ) {
      throw new ApiError(
        "Required fields: title, discountType, discountValue, validTill"
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        $push: {
          offers: {
            title,
            description,
            code,
            discountType,
            discountValue,
            minOrderAmount,
            validTill: new Date(validTill),
            _id: new mongoose.Types.ObjectId(),
          },
        },
      },
      { new: true }
    );

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: restaurant.offers,
    });
  }),

  getActiveRestaurantOffers: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const currentDate = new Date();

    const restaurant = await Restaurant.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $project: {
          activeOffers: {
            $filter: {
              input: "$offers",
              as: "offer",
              cond: { $gt: ["$$offer.validTill", currentDate] },
            },
          },
        },
      },
    ]);

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.json({
      success: true,
      message: "Active Offers got Successfully",
      data: restaurant[0].activeOffers,
    });
  }),

  updateRestaurantOffers: asyncHandler(async (req, res) => {
    const { id, offerId } = req.params;
    const updateData = req.body;

    if (updateData.code) {
      res.status(400);
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Offer code cannot be modified"
      );
    }

    const restaurant = await Restaurant.findOneAndUpdate(
      {
        _id: id,
        "offers._id": offerId,
        $set: {
          "offers.$[elem].title": updateData.title,
          "offers.$[elem].description": updateData.description,
          "offers.$[elem].discountType": updateData.discountType,
          "offers.$[elem].discountValue": updateData.discountValue,
          "offers.$[elem].minOrderAmount": updateData.minOrderAmount,
          "offers.$[elem].validTill": new Date(updateData.validTill),
        },
      },
      { new: true, arrayFilters: [{ "elem._id": offerId }] }
    ).select("offers");

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    res.json({
      success: true,
      message: "Offer updated successfully",
      data: restaurant.offers,
    });
  }),

  toggleRestaurantOffers: asyncHandler(async (req, res) => {
    const { id, offerId } = req.params;
    const { action } = req.body;

    if (!["activate", "deactivate"].includes(action)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid action. Use 'activate' or 'deactivate'"
      );
    }

    const newDate =
      action === "activate"
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : new Date();

    const restaurant = await Restaurant.findOneAndUpdate(
      { _id: id, "offers._id": offerId },
      { $set: { "offers.$.validTill": newDate } },
      { new: true }
    ).select("offers");

    if (!restaurant) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Restaurant or offer not found"
      );
    }

    res.json({
      success: true,
      message: `Offer ${action}d successfully`,
      data: restaurant.offers,
    });
  }),

  // Analytics & Insights
  getRestaurantAnalytics: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const analytics = await Restaurant.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $project: {
          orderStats: {
            totalOrder: "$orderCount",
            lastOrder: "$lastOrderTime",
            avgPreparationTime: "$preparationTime",
          },
        },
        popularity: {
          views: "$viewCount",
          averageRating: { $round: ["$averageRating", 1] },
        },
        deliveryMetrics: {
          deliveryAvailable: "$deliveryDetails.isDeliveryAvailable",
          avgDeliveryTime: {
            $avg: [
              "$deliveryDetails.estimatedDeliveryTime.min",
              "$deliveryDetails.estimatedDeliveryTime.max",
            ],
          },
        },
      },
    ]);

    if (!analytics.length) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }
  }),

  getRestaurantRatingsAnalytics: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id)
      .select("rating reviewCount")
      .lean();

    if (!restaurant) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    const ratings = {
      overall: restaurant.rating.overall,
      foodQuality: restaurant.rating.foodQuality,
      deliveryExperience: restaurant.rating.deliveryExperience,
      packaging: restaurant.rating.packaging,
      totalReviews: restaurant.reviewCount,
      averageRating:
        (restaurant.rating.overall +
          restaurant.rating.foodQuality +
          restaurant.rating.deliveryExperience) /
        3,
    };
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Restaurant rating analysis",
      data: ratings,
    });
  }),

  getRestaurantTimingsAnalytics: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id)
      .select(
        "openingHours preparationTime deliveryDetails.estimatedDeliveryTime"
      )
      .lean();

    if (!restaurant) {
      res.status(404);
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    const timings = {
      openingHours: restaurant.openingHours,
      averagePreparation: restaurant.preparationTime,
      deliveryTimeRange: restaurant.deliveryDetails.estimatedDeliveryTime,
      operationalDays: restaurant.openingHours.filter((day) => !day.isClosed)
        .length,
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Restaurant timing analysis",
      data: ratings,
    });
  }),

  // Search & Discovery
  searchRestaurants: asyncHandler(async (req, res) => {
    const { query } = req.query;

    if (!query) {
      res.status(400);
      throw new ApiError(StatusCodes.BAD_REQUEST, "Search query required");
    }

    const results = await Restaurant.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(20)
      .select("name slug cuisineType rating.overall deliveryDetails isPureVeg");

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Your search has been completed successfully",
      count: results.length,
      data: results,
    });
  }),

  filterRestaurants: asyncHandler(async (req, res) => {
    const { cuisine, minRating, priceRange, isPureVeg } = req.query;
    const filter = {};

    if (cuisine) filter.cuisineType = { $in: cuisine.split(",") };
    if (minRating) filter["rating.overall"] = { $gte: Number(minRating) };
    if (priceRange) filter.priceRange = { $lte: Number(priceRange) };
    if (isPureVeg) filter.isPureVeg = isPureVeg === "true";

    const restaurants = await Restaurant.find(filter)
      .limit(50)
      .select(
        "name slug cuisineType priceRange rating.overall deliveryDetails isPureVeg"
      );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Your filter has been completed successfully",
      count: restaurants.length,
      data: restaurants,
    });
  }),

  getTrendingRestaurants: asyncHandler(async (req, res) => {
    const trending = await Restaurant.aggregate([
      {
        $addFields: {
          popularityScore: {
            $add: [
              { $multiply: ["$orderCount", 0.5] },
              { $multiply: ["$viewCount", 0.3] },
              { $multiply: ["$averageRating", 200] },
            ],
          },
        },
      },
      { $sort: { popularityScore: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          slug: 1,
          cuisineType: 1,
          rating: "$rating.overall",
          orderCount: 1,
          image: { $arrayElemAt: ["$images.url", 0] },
        },
      },
    ]);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Your tranding has been completed successfully",
      count: trending.length,
      data: trending,
    });
  }),

  // Administration & Verification
  verifyRestaurant: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Verification status must be a boolean"
      );
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { isVerified: verified },
      { new: true, runValidators: true }
    ).select("isVerified");

    if (!restaurant) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant not found");
    }

    const isVerifiedValue = `Restaurant ${
      verified ? "verified" : "unverified"
    } successfully`;

    res.json({
      success: true,
      message: isVerifiedValue,
      data: restaurant.isVerified,
    });
  }),
  updateRestaurantOwners: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newOwnerId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(newOwnerId)) {
      res.status(400);
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid owner ID");
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { owner: newOwnerId },
      { new: true, runValidators: true }
    ).select("owner");

    if (!restaurant) {
      res.status(404);
      throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Restaurant owner updated successfully",
      data: restaurant.owner,
    });
  }),

  addRestaurantManager: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { managerId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      res.status(400);
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid manager ID");
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $addToSet: { managers: managerId } },
      { new: true, runValidators: true }
    ).select("managers");

    if (!restaurant) {
      res.status(404);
      throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant not found");
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Manager added successfully",
      data: restaurant.managers,
    });
  }),

  removeRestaurantManager: asyncHandler(async (req, res) => {
    const { id, managerId } = req.params;

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $pull: { managers: managerId } },
      { new: true }
    ).select("managers");

    if (!restaurant) {
      res.status(404);
      throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Manager removed successfully",
      data: restaurant.managers,
    });
  }),

  // Utility Endpoints
  getRestaurantCuisines: asyncHandler(async (req, res) => {
    const cuisines = await Restaurant.aggregate([
      { $unwind: "$cuisineType" },
      { $group: { _id: "$cuisineType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { cuisine: "$_id", _id: 0 } },
    ]);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Restaurant Cuisines fetched succesfully.",
      count: cuisines.length,
      data: cuisines.map((c) => c.cuisine),
    });
  }),
  getRestaurantFoodTypes: asyncHandler(async (req, res) => {
    const foodTypes = await Restaurant.aggregate([
      { $unwind: "$foodType" },
      { $group: { _id: "$foodType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { foodType: "$_id", _id: 0 } },
    ]);
    res.json({
      success: true,
      message: "Restaurant Food Types fetched succesfully.",
      count: foodTypes.length,
      data: foodTypes.map((ft) => ft.foodType),
    });
  }),

  // Categories Endpoints
  getAllCategoryResturant: asyncHandler(async (req, res) => {}),
  activeCategory: asyncHandler(async (req, res) => {}),
  featuredCategory: asyncHandler(async (req, res) => {}),
  popularCategory: asyncHandler(async (req, res) => {}),
  popularCategory: asyncHandler(async (req, res) => {}),
  availableCategory: asyncHandler(async (req, res) => {}),
  statsCategory: asyncHandler(async (req, res) => {}),
};

export default RestaurantController;
