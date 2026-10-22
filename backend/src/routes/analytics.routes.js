import { Router } from "express";
import { getComplaintAnalytics } from "../controller/analytics.controller.js";
import { protectRoute, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Login required + admin role required.
router.use(protectRoute, authorizeRoles("admin"));

router.get("/", getComplaintAnalytics);

export default router;
