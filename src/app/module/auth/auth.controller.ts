import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { authService } from "./auth.service";
import { catchAsync } from "../../utiles/catchAsync";
import { sendResponse } from "../../utiles/sendResponse";
import z from "zod";



const patientRegisterSchema = z.object({
  name:z.string().min(3).max(8),
  password:z.string()
  .min(8)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[\!@#\$%\^&\*]/),
  email:z.string(),
  patient:z.object({
    contractNumber:z.string().optional()
  }).optional()
})

const registerPatient = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = patientRegisterSchema.safeParse(req.body);
    if(!payload.success){
      throw new Error(payload.error.message)
    }
    const result = await authService.registerUserIntoDb(payload.data as any);

    const { user, patient } = result;
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Patient created successfully",
      data: {
        user,
        patient,
      },
    });
  },
);
const loginPatient = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const result = await authService.loginPatientIntoDb(payload);
    const { accessToken, refreshToken } = result;

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // const { user, patient } = result;
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Patient login successfully",
      data: {
        accessToken,
        refreshToken,
      },
    });
  },
);
const getMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw new Error("User information is wrong");
    }
    const result = await authService.getMePatient(user);
    // const { user, patient } = result;
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User profile fetched successfully",
      data: result,
    });
  },
);

const refreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.refreshToken;
    if (!token) {
      throw new Error("RefreshToken is missing");
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshToken(token);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    });
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // const { user, patient } = result;
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Patient login successfully",
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  },
);

const googleLogin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const result = await authService.googleLogin(payload);
    const { accessToken, refreshToken } = result;

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User login successfully",
      data: {
        accessToken,
		refreshToken
      },
    });
  },
);

export const authController = {
  registerPatient,
  loginPatient,
  getMe,
  refreshToken,
  googleLogin,
};
