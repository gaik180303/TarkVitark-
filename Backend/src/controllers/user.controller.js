import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Follow from "../models/follow.model.js";
import { DebateRoom } from "../models/debateRoom.model.js";
import { COOKIE_OPTIONS } from "../constant.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch {
    throw new ApiError(500, "Failed to generate access and refresh tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;

  if ([fullName, email, username, password].some(field => !field?.trim())) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  let avatarUrl = "";
  const avatarLocalPath = req.files?.profilePic?.[0]?.path;

  if (avatarLocalPath) {
    const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath);
    if (!uploadedAvatar?.url) {
      throw new ApiError(502, "Avatar upload failed. Please try again.");
    }
    avatarUrl = uploadedAvatar.url;
  }

  const user = await User.create({
    fullName,
    avatarUrl,
    email,
    username: username.toLowerCase(),
    password,
  });

  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, "Failed to create user");
  }

  return res.status(201).json(
    new ApiResponse(201, createdUser, "User created successfully")
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if ((!username && !email) || !password) {
    throw new ApiError(400, "Username/email and password are required");
  }

  // Build the query only from fields that were actually provided, and only accept strings
  // (guards against operator-injection payloads like { "$gt": "" }).
  const identifiers = [];
  if (typeof username === "string" && username.trim()) identifiers.push({ username: username.toLowerCase() });
  if (typeof email === "string" && email.trim()) identifiers.push({ email: email.toLowerCase() });
  if (identifiers.length === 0 || typeof password !== "string") {
    throw new ApiError(400, "Username/email and password are required");
  }

  const user = await User.findOne({ $or: identifiers });

  // Same message for unknown user and wrong password — no account enumeration.
  const isPasswordValid = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  return res
    .status(200)
    .cookie("accessToken", accessToken, COOKIE_OPTIONS)
    .cookie("refreshToken", refreshToken, COOKIE_OPTIONS)
    .json(new ApiResponse(200, { user: loggedInUser }, "User logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 }
  });

  return res
    .status(200)
    .clearCookie("accessToken", COOKIE_OPTIONS)
    .clearCookie("refreshToken", COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);

    if (!user || incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, COOKIE_OPTIONS)
      .cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS)
      .json(new ApiResponse(200, {}, "Access token refreshed"));

  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (typeof oldPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid current password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  // verifyJWT already fetched the user without password/refreshToken
  return res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetail = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(req.user._id, {
    $set: { fullName, email }
  }, { new: true }).select("-password");

  return res.status(200).json(new ApiResponse(200, user, "Account details updated"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // multerUploads uses .fields(), which populates req.files (not req.file)
  const avatarLocalPath = req.files?.profilePic?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar?.url) {
    throw new ApiError(502, "Failed to upload avatar");
  }

  const user = await User.findByIdAndUpdate(req.user._id, {
    $set: { avatarUrl: avatar.url }
  }, { new: true }).select("-password -refreshToken");

  return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const user = await User.findOne({ username: username.toLowerCase() }).select("username fullName avatarUrl");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const [followersCount, followingCount] = await Promise.all([
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id }),
  ]);

  let isFollowing = false;
  if (req.user?._id) {
    const followDoc = await Follow.findOne({
      follower: req.user._id,
      following: user._id,
    });
    isFollowing = !!followDoc;
  }

  return res.status(200).json(
    new ApiResponse(200, {
      username: user.username,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      followersCount,
      followingCount,
      isFollowing,
    }, "User profile fetched")
  );
});

const getHostedDebateRooms = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  const hostedRooms = await DebateRoom.aggregate([
    { $match: { host: userId } },
    {
      $lookup: {
        from: "users",
        localField: "participants",
        foreignField: "_id",
        as: "participants",
        pipeline: [
          { $project: { fullName: 1, username: 1, avatarUrl: 1 } }
        ]
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "host",
        foreignField: "_id",
        as: "host",
        pipeline: [
          { $project: { fullName: 1, username: 1, avatarUrl: 1 } }
        ]
      }
    },
    { $addFields: { host: { $first: "$host" } } },
    { $sort: { createdAt: -1 } }
  ]);

  return res.status(200).json(new ApiResponse(200, hostedRooms, "Hosted debate rooms fetched"));
});

const getPastParticipatedDebates = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const pastDebates = await DebateRoom.aggregate([
    {
      $match: {
        status: "ended",
        participants: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "host",
        foreignField: "_id",
        as: "host",
        pipeline: [
          { $project: { username: 1, avatarUrl: 1 } }
        ]
      },
    },
    { $addFields: { host: { $first: "$host" } } },
    {
      $project: {
        title: 1,
        description: 1,
        scheduledAt: 1,
        status: 1,
        for: 1,
        against: 1,
        host: 1,
        participantsCount: { $size: "$participants" },
        createdAt: 1,
      },
    },
    { $sort: { scheduledAt: -1 } }
  ]);

  return res.status(200).json(new ApiResponse(200, pastDebates, "Past participated debates fetched"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetail,
  updateUserAvatar,
  getUserChannelProfile,
  getHostedDebateRooms,
  getPastParticipatedDebates
};

