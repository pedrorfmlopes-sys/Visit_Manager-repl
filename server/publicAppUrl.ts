import type { Request } from "express";

export function getPublicAppBaseUrl(req: Request) {
  const configuredUrl = process.env.APP_BASE_URL?.trim();
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("APP_BASE_URL must use HTTP or HTTPS");
    }
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error("APP_BASE_URL must use HTTPS in production");
    }
    return url.origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL must be configured in production");
  }
  return `${req.protocol}://${req.get("host")}`;
}

export function buildPasswordSetupUrl(req: Request, token: string) {
  return new URL(
    `/login?resetToken=${encodeURIComponent(token)}`,
    getPublicAppBaseUrl(req),
  ).toString();
}
