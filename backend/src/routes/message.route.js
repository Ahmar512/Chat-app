import express from 'express'
import { protectRoute } from '../middleware/auth.middleware.js';
import { getUsersForSidebar, searchUsers, getMessages, sendMessage } from '../controllers/message.controller.js';

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/search", protectRoute, searchUsers);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);

export default router;