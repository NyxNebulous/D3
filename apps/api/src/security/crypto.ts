import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual
} from "node:crypto";

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}

export function signQrId(qrId: string, secret: string): string {
  return createHmac("sha256", secret).update(`qr:${qrId}`).digest("hex");
}

export function verifyQrSignature(qrId: string, signature: string, secret: string): boolean {
  const expected = signQrId(qrId, secret);
  return safeEqualHex(signature, expected);
}

export function createOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(otp: string, salt: string, secret: string): string {
  return createHmac("sha256", secret).update(`${salt}:${otp}`).digest("hex");
}

export function verifyOtp(otp: string, salt: string, secret: string, expectedHash: string): boolean {
  return safeEqualHex(hashOtp(otp, salt, secret), expectedHash);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const params = { N: 16384, r: 8, p: 1 };
  const hash = scryptSync(password, salt, 64, params).toString("hex");
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encodedHash: string): boolean {
  const [algorithm, n, r, p, salt, expected] = encodedHash.split("$");

  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expected) {
    return false;
  }

  const actual = scryptSync(password, salt, 64, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  }).toString("hex");

  return safeEqualHex(actual, expected);
}

function safeEqualHex(actualHex: string, expectedHex: string): boolean {
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

