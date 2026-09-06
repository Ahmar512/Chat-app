import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
    {
        callerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["missed", "rejected", "completed", "busy"],
            default: "missed",
        },
        callType: {
            type: String,
            enum: ["audio", "video"],
            default: "audio",
        },
        duration: {
            type: Number, // in seconds
            default: 0,
        },
    },
    { timestamps: true }
);

const Call = mongoose.model("Call", callSchema);

export default Call;
