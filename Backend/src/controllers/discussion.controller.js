import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import { DebateRoom } from "../models/debateRoom.model.js";
import DebateRegistration from "../models/debateRegistration.model.js";

const getActiveDebates = asyncHandler(async (req, res) => {
  const debates = await DebateRoom.find({ status: 'ongoing' })
    .populate('host', 'fullName username avatarUrl')
    .sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, debates, "Active debates fetched successfully"));
});

const getUpcomingDebates = asyncHandler(async (req, res) => {
  const debates = await DebateRoom.find({ status: 'scheduled' })
    .populate('host', 'fullName username avatarUrl')
    .sort({ scheduledAt: 1 });
  return res.status(200).json(new ApiResponse(200, debates, "Upcoming debates fetched successfully"));
});

const registerForDebate = asyncHandler(async (req, res) => {
  const { debateId, stance, agreedToRules } = req.body;

  if (!debateId || !mongoose.isValidObjectId(debateId)) {
    throw new ApiError(400, "A valid debate ID is required");
  }
  if (!stance || !['in_favor', 'against'].includes(stance)) {
    throw new ApiError(400, "Valid stance is required");
  }
  if (agreedToRules !== true) {
    throw new ApiError(400, "Must agree to debate rules");
  }

  const debate = await DebateRoom.findById(debateId);
  if (!debate) {
    throw new ApiError(404, "Debate not found");
  }
  if (debate.status === "ended") {
    throw new ApiError(400, "This debate has ended and is no longer open for registration");
  }

  const existingRegistration = await DebateRegistration.findOne({
    debate: debateId,
    "participant.user": req.user._id
  });
  if (existingRegistration) {
    throw new ApiError(409, "You are already registered for this debate");
  }

  // The compound unique index on { debate, participant.user } is the backstop
  // against races; a duplicate here surfaces as a 409 via the global error handler.
  const registration = await DebateRegistration.create({
    debate: debateId,
    participant: {
      user: req.user._id,
      stance,
      agreedToRules
    },
    activityLog: [{ action: "joined" }]
  });

  if (!debate.participants.some(p => p.equals(req.user._id))) {
    debate.participants.push(req.user._id);
    await debate.save();
  }

  return res.status(201).json(
    new ApiResponse(201, registration, "Successfully registered for debate")
  );
});

// Current user's registration (stance) for a debate room
const getRegistrationForDebate = asyncHandler(async (req, res) => {
  const { id: debateId } = req.params;

  if (!mongoose.isValidObjectId(debateId)) {
    throw new ApiError(400, "Invalid debate id");
  }

  const registration = await DebateRegistration.findOne({
    debate: debateId,
    "participant.user": req.user._id
  });

  if (!registration) {
    throw new ApiError(404, "Not registered for this debate");
  }

  return res.status(200).json(
    new ApiResponse(200, { stance: registration.participant.stance }, "Registration fetched")
  );
});

const getDebateDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const debate = await DebateRoom.findById(id)
    .populate('host', 'fullName username avatarUrl')
    .populate('participants', 'fullName username avatarUrl');
  if (!debate) throw new ApiError(404, "Debate not found");
  return res.status(200).json(new ApiResponse(200, debate, "Debate details fetched"));
});

const createDebate = asyncHandler(async (req, res) => {
  const { title, description, scheduledAt } = req.body;
  if (!title || !description || !scheduledAt) throw new ApiError(400, "All fields required");

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new ApiError(400, "scheduledAt must be a valid date");
  }

  // The host is always the authenticated user — never taken from the request body.
  const debate = await DebateRoom.create({
    title,
    description,
    scheduledAt: scheduledDate,
    host: req.user._id,
    status: 'scheduled',
    participants: [req.user._id],
  });
  return res.status(201).json(new ApiResponse(201, debate, "Debate created successfully"));
});

const getHostedDebates = asyncHandler(async (req, res) => {
  const debates = await DebateRoom.find({ host: req.user._id })
    .sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, debates, "Hosted debates fetched"));
});

const getParticipatedDebates = asyncHandler(async (req, res) => {
  const debates = await DebateRoom.find({ participants: req.user._id })
    .sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, debates, "Participated debates fetched"));
});

export {
  getActiveDebates,
  getUpcomingDebates,
  registerForDebate,
  getRegistrationForDebate,
  getDebateDetails,
  createDebate,
  getHostedDebates,
  getParticipatedDebates,
};
