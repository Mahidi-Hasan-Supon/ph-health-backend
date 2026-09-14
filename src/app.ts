import cookieParser from "cookie-parser";
import express, {
	NextFunction,
  type Application,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import config from "./app/config";
import httpStatus from "http-status";
import { authRoute } from "./app/module/auth/auth.route";
import { prisma } from "./app/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, UserStatus } from "../generated/prisma/enums";
import { globalErrorHandler } from "./app/middleware/globalErrorHandleing";
import { notFound } from "./app/middleware/notFound";
import z from "zod";
const app: Application = express();

app.use(
  cors({
    origin: config.backend_url,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// app.use("api/v1/auth" , authRoute)

app.use("/api/v1/auth", authRoute);

app.post("/zod", async (req: Request, res: Response , next:NextFunction) => {
  try {
    const user = z.object({
      name: z.string(),
      age: z.number(),
    });
    const payload = req.body;
    const result = user.parse(payload);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Welcome to our ph healthcare project",
	  data:{
		result
	  }
    });
  } catch (error) {
	next(error)

  }
});

app.get("/", async (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to our ph healthcare project",
  });
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
