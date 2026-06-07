import { AccessToken } from "../models/login";
import { decodedToken } from "../utils/jwt";

const AUTH_CHANGE_EVENT = "story-spark-auth-change";

let authToken: string | null = null;

const emitAuthChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
};

export type AuthUserInfo = {
  email: string;
  userId: string;
  name: string;
  postsCount: number;
  role: string;
  subscriptionType: string;
  exp: number;
  iat: number;
  avatar?: string;
};

interface RawJwtPayload {
  email?: string;
  userId?: string;
  _id?: string;
  name?: string;
  postsCount?: number;
  role?: string;
  subscriptionType?: string;
  exp?: number;
  iat?: number;
  avatar?: string;
}

const buildUserInfo = (decodedData: RawJwtPayload): AuthUserInfo => ({
  email: decodedData?.email || "",
  userId: decodedData?.userId || decodedData?._id || "",
  name: decodedData?.name || "",
  postsCount: decodedData?.postsCount || 0,
  role: decodedData?.role || "guest",
  subscriptionType: decodedData?.subscriptionType || "free",
  exp: decodedData?.exp || 0,
  iat: decodedData?.iat || 0,
  avatar: decodedData?.avatar || "",
});

const getValidDecodedToken = () => {
  if (!authToken) return null;
  try {
    const decodedData = decodedToken(authToken);
    if (!decodedData) { authToken = null; return null; }
    if (typeof decodedData.exp === "number" &&
      decodedData.exp <= Math.floor(Date.now() / 1000)) {
      authToken = null; return null;
    }
    return buildUserInfo(decodedData);
  } catch (error) {
    console.error("Invalid auth token:", error);
    authToken = null; return null;
  }
};

export const storeUserInfo = ({ accessToken }: AccessToken) => {
  authToken = accessToken;
  emitAuthChange();
};

export const getUserInfo = (): AuthUserInfo | null => getValidDecodedToken();
export const isLoggedIn = () => !!getValidDecodedToken();
export const removeUserInfo = () => { authToken = null; emitAuthChange(); };
export const getToken = () => authToken;
export const authChangeEventName = AUTH_CHANGE_EVENT;