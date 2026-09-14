import { HTTP_STATUS } from "./httpStatusCodes.js";

export const SESSION_MAX_AGE = Number(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE = Number(process.env.COOKIE_MAX_AGE) || 24 * 60 * 60 * 1000;

export { HTTP_STATUS };