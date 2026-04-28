/**
 * Password hashing utilities using Bun's built-in password API
 */

import { password } from "bun";

/**
 * Hash a password using Bun's built-in hashing
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return await password.hash(plainPassword);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await password.verify(plainPassword, hashedPassword);
}