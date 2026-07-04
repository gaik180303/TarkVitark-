import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import Message from "../models/message.model.js";
import { DebateRoom } from "../models/debateRoom.model.js";

// Chat history for a debate room. Real-time delivery happens over the socket;
// this endpoint backfills history when the room is opened.
const getMessagesForDebate = asyncHandler(async (req, res) => {
  const { debateId } = req.params;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(debateId)) {
    throw new ApiError(400, "Invalid debate id");
  }

  const debate = await DebateRoom.findById(debateId);
  if (!debate) {
    throw new ApiError(404, "Debate room not found");
  }

  const isParticipant = debate.participants.some(p => p.equals(userId));
  if (!isParticipant) {
    throw new ApiError(403, "You are not authorized to view this chat history");
  }

  const messages = await Message.find({ debateId })
    .populate("sender", "fullName username avatarUrl")
    .sort({ createdAt: 1 });

  return res.status(200).json(new ApiResponse(200, messages, "Messages fetched successfully"));
});

export {
  getMessagesForDebate,
};
