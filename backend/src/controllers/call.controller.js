import Call from "../models/call.model.js";

export const getCallHistory = async (req, res) => {
    try {
        const myId = req.user._id;
        const calls = await Call.find({
            $or: [{ callerId: myId }, { receiverId: myId }],
        })
            .populate("callerId", "fullName profilePic email")
            .populate("receiverId", "fullName profilePic email")
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json(calls);
    } catch (error) {
        console.error("Error in getCallHistory controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
