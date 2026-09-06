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

export const getIceServers = async (req, res) => {
    try {
        // 1. If custom Metered API key is set in environment
        if (process.env.METERED_API_KEY) {
            try {
                const domain = process.env.METERED_DOMAIN || "app";
                const response = await fetch(
                    `https://${domain}.metered.ca/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`
                );
                const servers = await response.json();
                if (Array.isArray(servers) && servers.length > 0) {
                    return res.status(200).json(servers);
                }
            } catch (err) {
                console.error("Error fetching Metered credentials:", err.message);
            }
        }

        // 2. High-reliability Production STUN + TURN (OpenRelay & Google)
        const iceServers = [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:standard.relay.metered.ca:80" },
            {
                urls: "turn:standard.relay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:standard.relay.metered.ca:80?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:standard.relay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:standard.relay.metered.ca:443?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
        ];

        res.status(200).json(iceServers);
    } catch (error) {
        console.error("Error in getIceServers:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
