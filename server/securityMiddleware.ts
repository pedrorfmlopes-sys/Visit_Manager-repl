import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self)",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
}
