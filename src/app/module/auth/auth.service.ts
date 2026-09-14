import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import type {
  IGetMePayload,
  IGooglePayload,
  ILoginPayload,
  IRegisterPayload,
} from "./auth.interface";
import config from "../../config";
import {
  AuthProvider,
  Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import { type JwtPayload } from "jsonwebtoken";
import { jwtUtils } from "../../utiles/jwt";
import { googleClient } from "../../lib/googleAuth";
import { GoogleAuth, TokenPayload } from "google-auth-library";
import { ref } from "process";

const registerUserIntoDb = async (payload: IRegisterPayload) => {
  const { name, password  , patient:patientData} = payload;
  const email = payload.email.trim().toLowerCase();
  // console.log(payload);

  const isExistUser = await prisma.user.findUnique({
    where: { email },
  });

  if (isExistUser) {
    throw new Error("User already exist");
  }

  const passwordSecure = await bcrypt.hash(
    password,
    Number(config.hashPassword),
  );

  const createUser = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordSecure,
      role: Role.PATIENT,
      status: UserStatus.ACTIVE,
      emailVerified: false,
      patient: {
        create: { name, email ,contactNumber:patientData?.contractNumber || undefined},
      },
    },
    include: { patient: true },
    omit: { password: true },
  });

  const { patient, ...user } = createUser;

  return {
    user,
    patient,
  };
};

const loginPatientIntoDb = async (payload: ILoginPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    throw new Error("User not found");
  }
  if (user.status === UserStatus.BLOCKED) {
    throw new Error("User Blocked");
  }
  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new Error("User account is deleted");
  }
  if(user.password === null && user.googleId !== null){
	throw new Error("User already exist From register account")
  }
  const matchPass = await bcrypt.compare(password, user?.password as string);
  if (!matchPass) {
    throw new Error("Password is incorrect");
  }

  const payloadJwt = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    payloadJwt,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );
  const refreshToken = jwtUtils.createToken(
    payloadJwt,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const getMePatient = async (user: IGetMePayload) => {
  const isExistUser = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    omit: { password: true },
    include: { patient: true },
  });

  if (!isExistUser) {
    throw new Error("User not found");
  }

  return isExistUser;
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new Error(
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new Error("User is inactive or not found");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const googleLogin = async (payload: IGooglePayload) => {
  let googleIdTokenPayload: TokenPayload | null | undefined = null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });
    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("GoogleIdToken verification failed google id token", error);
    throw new Error("Token expire in or invalid");
  }
  if (!googleIdTokenPayload) {
    throw new Error("Token expire in or invalid");
  }
  if (!googleIdTokenPayload.name) {
    throw new Error("User name not found");
  }
  if (!googleIdTokenPayload.email) {
    throw new Error("Google email not found");
  }
  const isPatientExistGoogleAuth = await prisma.user.findUnique({
    where: {
      email: googleIdTokenPayload.email,
      role: Role.PATIENT,
      google: googleIdTokenPayload.sub,
    },
  });

  let user = isPatientExistGoogleAuth;
  if (!isPatientExistGoogleAuth) {
    const isPatientExistWithCredentials = await prisma.user.findUnique({
      where: {
        email: googleIdTokenPayload.email,
        role: Role.PATIENT,
        authProvider: AuthProvider.credentials,
      },
    });
    if (isPatientExistWithCredentials) {
		if(!isPatientExistWithCredentials){
			throw new Error("Email verified not found")
		}
      if (isPatientExistWithCredentials.status === "BLOCKED") {
        throw new Error("User status Blocked");
      }
      if (
        isPatientExistWithCredentials?.isDeleted ||
        isPatientExistWithCredentials.status === UserStatus.DELETED
      ) {
        throw new Error("User is deleted");
      }
      user = await prisma.user.update({
        where: {
          id: isPatientExistWithCredentials.id,
        },
        data: {
          googleId: googleIdTokenPayload.sub,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name,
          email: googleIdTokenPayload.email,
          role: Role.PATIENT,
          google: googleIdTokenPayload.sub,
          emailVerified: true,
          authProvider: AuthProvider.google,
          patient: {
            create: {
              name: googleIdTokenPayload.name,
              email: googleIdTokenPayload.email,
            },
          },
        },
      });
    }
  }
  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === "BLOCKED") {
    throw new Error("User status Blocked");
  }
  if (user?.isDeleted || user.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in,
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const authService = {
  registerUserIntoDb,
  loginPatientIntoDb,
  getMePatient,
  refreshToken,
  googleLogin,
};
