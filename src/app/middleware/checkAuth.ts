import type { NextFunction, Request, Response } from "express";
import { type Role, UserStatus } from "../../../generated/prisma/enums";
import { catchAsync } from "../utiles/catchAsync";
import { jwtUtils } from "../utiles/jwt";
import config from "../config";
import type { JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import httpStatus from "http-status";

// namespace
declare global {
	namespace Express {
		interface Request {
			user?: {
				name: string;
				email: string;
				role: Role;
				userId: string;
			};
		}
	}
}

export const auth = (...requiredRole: Role[]) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const token = req.cookies.accessToken
			? req.cookies.accessToken
			: req.headers.authorization?.startsWith("Bearer")
				? req.headers.authorization?.split(" ")[1]
				: req.headers.authorization;
		// console.log(token);
		if (!token) {
			throw new Error("You are not log in");
		}
		const verified = jwtUtils.verifyToken(token, config.jwt_access_secret);

		if (!verified.success) {
			throw new Error(verified.error);
		}
		const { email, name, userId, role } = verified.data as JwtPayload;

		if (requiredRole.length && !requiredRole.includes(role)) {
			return res.status(403).json({
				success: false,
				statusCode: httpStatus.FORBIDDEN,
				message: "Forbidden,you don't have permission this user",
			});
		}

		const user = await prisma.user.findUnique({
			where: {
				id: userId,
				email,
				name,
				role,
			},
		});
		if (!user) {
			throw new Error("Please Login in");
		}
		if (user.status === "BLOCKED") {
			throw new Error("YOU account has been blocked");
		}

		req.user = {
			userId,
			name,
			role,
			email,
		};
		next();
	});
};
