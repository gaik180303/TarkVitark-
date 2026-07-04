import mongoose, { Schema } from "mongoose";

// "Minds Changed" voting: each user records where they stand BEFORE the debate
// and AFTER it. The winner is the side that moved more people (largest swing),
// not the side with the bigger crowd.
const voteSchema = new Schema(
  {
    debate: {
      type: Schema.Types.ObjectId,
      ref: "DebateRoom",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phase: {
      type: String,
      enum: ["pre", "post"],
      required: true,
    },
    stance: {
      type: String,
      enum: ["in_favor", "against"],
      required: true,
    },
  },
  { timestamps: true }
);

// One vote per user per phase per debate; re-voting updates the existing doc.
voteSchema.index({ debate: 1, user: 1, phase: 1 }, { unique: true });

// Aggregate counts into { pre: {in_favor, against}, post: {in_favor, against} }.
voteSchema.statics.summaryFor = async function (debateId) {
  const rows = await this.aggregate([
    { $match: { debate: new mongoose.Types.ObjectId(debateId) } },
    { $group: { _id: { phase: "$phase", stance: "$stance" }, count: { $sum: 1 } } },
  ]);

  const summary = {
    pre: { in_favor: 0, against: 0 },
    post: { in_favor: 0, against: 0 },
  };
  for (const row of rows) {
    summary[row._id.phase][row._id.stance] = row.count;
  }
  return summary;
};

export const Vote = mongoose.model("Vote", voteSchema);
