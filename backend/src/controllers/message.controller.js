import User from "../models/user.model.js"
import Message from "../models/message.model.js"
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        // Find all messages where the logged-in user is sender or receiver
        const messages = await Message.find({
            $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
        }).sort({ createdAt: -1 });

        const chattedUserIds = [];
        const seenUserIds = new Set();
        const lastMessageMap = {};

        for (const msg of messages) {
            const isSender = msg.senderId.toString() === loggedInUserId.toString();
            const otherUserId = isSender
                ? msg.receiverId.toString()
                : msg.senderId.toString();

            if (!seenUserIds.has(otherUserId)) {
                seenUserIds.add(otherUserId);
                chattedUserIds.push(otherUserId);
                lastMessageMap[otherUserId] = {
                    text: msg.text,
                    image: msg.image,
                    createdAt: msg.createdAt,
                    isSender,
                };
            }
        }

        // Fetch user profiles for these chatted IDs
        const users = await User.find({ _id: { $in: chattedUserIds } }).select("-password");

        // Sort users in the exact order of their most recent message
        const userMap = new Map(users.map((u) => [u._id.toString(), u.toObject()]));
        const sortedUsers = chattedUserIds
            .map((id) => {
                const user = userMap.get(id);
                if (!user) return null;
                return {
                    ...user,
                    lastMessage: lastMessageMap[id],
                };
            })
            .filter(Boolean);

        res.status(200).json(sortedUsers);
    } catch (error) {
        console.error("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const searchUsers = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const { search = "" } = req.query;

        let query = { _id: { $ne: loggedInUserId } };

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            query.$or = [{ fullName: regex }, { email: regex }];
        }

        const users = await User.find(query).select("-password").limit(40);
        res.status(200).json(users);
    } catch (error) {
        console.error("Error in searchUsers: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId }
            ]
        });

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessage controller: ", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
}
export const sendMessage = async (req, res) => {
    try {

        const { text, image } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;
        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
        });
        await newMessage.save();

        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.log("Error in sendMessage controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });

    }
}