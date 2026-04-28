/**
 * JWT utilities using jose library
 */

import { SignJWT, jwtVerify } from "jose";
import { v4 as uuidv4 } from "uuid";
import type { JwtPayload, UserRole } from "../types/auth.js";
import { config } from "../config/index.js";

// Convert secret to Uint8Array
const getSecretKey = () => new TextEncoder().encode(config.auth.jwtSecret);

/**
 * Sign a JWT token
 */
export async function signJwt(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
  const expiresIn = parseExpiresIn(config.auth.jwtExpiresIn);

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(getSecretKey());

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Parse expires in string to seconds
 * e.g., "24h" -> 86400, "7d" -> 604800
 */
function parseExpiresIn(expiresIn: string): number {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);

  switch (unit) {
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    case "m":
      return value * 60;
    case "s":
      return value;
    default:
      return 86400; // Default 24 hours
  }
}

/**
 * Generate a session token with unique tokenId
 */
export async function generateSessionToken(
  userId: string,
  username: string,
  role: UserRole
): Promise<{ token: string; tokenId: string }> {
  const tokenId = uuidv4();
  const token = await signJwt({ user_id: userId, username, role, token_id: tokenId });
  return { token, tokenId };
}