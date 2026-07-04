import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Vote } from "../models/vote.model.js";
import { DebateRoom } from "../models/debateRoom.model.js";
import { getIO } from "../socket.js";

// Winner = the side that gained the most between the pre and post votes ("minds changed").
const computeVerdict = (summary) => {
  const swingFor = summary.post.in_favor - summary.pre.in_favor;
  const swingAgainst = summary.post.against - summary.pre.against;
  // A side only "wins" if it actually gained ground and gained more than the other.
  let winner = "tie";
  if (swingFor > swingAgainst && swingFor > 0) winner = "in_favor";
  else if (swingAgainst > swingFor && swingAgainst > 0) winner = "against";
  return { swingFor, swingAgainst, winner };
};

const castVote = asyncHandler(async (req, res) => {
  const { id: debateId } = req.params;
  const { phase, stance } = req.body;

  if (!mongoose.isValidObjectId(debateId)) {
    throw new ApiError(400, "Invalid debate id");
  }

  const debate = await DebateRoom.findById(debateId).lean();
  if (!debate) {
    throw new ApiError(404, "Debate not found");
  }

  // A post-vote only makes sense once the debate is under way or finished.
  if (phase === "post" && debate.status === "scheduled") {
    throw new ApiError(400, "The debate hasn't started yet — you can only cast a pre-vote");
  }

  // Upsert so a user can change their mind within a phase without hitting the unique index.
  await Vote.findOneAndUpdate(
    { debate: debateId, user: req.user._id, phase },
    { $set: { stance } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const summary = await Vote.summaryFor(debateId);
  const verdict = computeVerdict(summary);

  // Push the new tallies to everyone watching the room (best-effort).
  getIO()?.to(String(debateId)).emit("voteUpdate", { summary, verdict });

  return res
    .status(200)
    .json(new ApiResponse(200, { summary, verdict }, "Vote recorded"));
});

const getVoteSummary = asyncHandler(async (req, res) => {
  const { id: debateId } = req.params;
  if (!mongoose.isValidObjectId(debateId)) {
    throw new ApiError(400, "Invalid debate id");
  }

  const summary = await Vote.summaryFor(debateId);

  // Tell the caller which phases they've personally voted in (to drive the UI).
  const myVotes = await Vote.find({ debate: debateId, user: req.user._id }).lean();
  const myVote = { pre: null, post: null };
  for (const v of myVotes) myVote[v.phase] = v.stance;

  return res
    .status(200)
    .json(new ApiResponse(200, { summary, verdict: computeVerdict(summary), myVote }, "Vote summary"));
});

export { castVote, getVoteSummary };
