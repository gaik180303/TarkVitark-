import mongoose from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const { Schema } = mongoose;

const debateRoomSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  host: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  status: {
    type: String,
    enum: ['ongoing', 'scheduled', 'ended'],
    default: 'scheduled'
  },
  scheduledAt: {
    type: Date
  },
  for: {
    type: Number,
    default: 0
  },
  against: {
    type: Number,
    default: 0
  },
  // Post-debate AI recap + stats ("match report"), generated when the host ends it.
  result: {
    summary: String,
    keyPointsFor: [String],
    keyPointsAgainst: [String],
    bestArgumentFor: String,
    bestArgumentAgainst: String,
    tone: String,
    judge: {
      scoreFor: Number,
      scoreAgainst: Number,
      winner: String,
      reasoning: String,
    },
    stats: {
      total: Number,
      forCount: Number,
      againstCount: Number,
      forSharePct: Number,
      flaggedCount: Number,
    },
    generatedAt: Date,
  },
}, { timestamps: true });


debateRoomSchema.plugin(mongooseAggregatePaginate);

export const DebateRoom = mongoose.model('DebateRoom', debateRoomSchema);
