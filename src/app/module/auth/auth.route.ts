import { Router } from "express";
import { authController } from "./auth.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";

const router = Router();

router.post("/register", authController.registerPatient);
router.get("/login", authController.loginPatient);
router.get(
	"/getMe",
	auth(Role.ADMIN, Role.DOCTOR, Role.SUPER_ADMIN, Role.PATIENT),
	authController.getMe,
);
router.post("/refreshToken", authController.refreshToken);
router.post("/googleLogin", authController.googleLogin);

export const authRoute = router;
