import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCallHistory, getIceServers } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/history", protectRoute, getCallHistory);
router.get("/ice-servers", protectRoute, getIceServers);

export default router;
