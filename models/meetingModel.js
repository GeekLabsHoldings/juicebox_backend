const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for quick user-based lookups
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true, // Index for quick service-based lookups
    },
    meetingStatus: {
      type: String,
      enum: ["accepted", "declined", "completed"],
      default: "accepted",
      index: true, // Index meeting status for quick filtering
    },
    date: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Meeting = mongoose.model("Meeting", meetingSchema);

module.exports = Meeting;
