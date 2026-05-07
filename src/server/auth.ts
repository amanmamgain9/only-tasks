import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { db } from "./db/client";
import { authSessions } from "./db/schema/sessions";
import { users } from "./db/schema/users";
import { ensureDefaultWorkspace } from "./projects/service";
import { getEffectiveSubscriptionForUser, type SubscriptionSummary } from "./subscriptions/service";

export const SESSION_COOKIE_NAME = "only_tasks_session";
export const GOOGLE_STATE_COOKIE_NAME = "only_tasks_google_state";
export const GOOGLE_REDIRECT_COOKIE_NAME = "only_tasks_google_redirect";
export const DEFAULT_AUTH_REDIRECT = "/app/workspace/all-tasks";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export type AuthenticatedUser = {
  id: number;
  email: string;
  name: string | null;
  image: string | null;
  profilePicture: string | null;
  isAdmin: boolean;
  subscription: SubscriptionSummary | null;
};

export type PendingSession = {
  token: string;
  expiresAt: Date;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function resolveGoogleCredentials(origin?: string | null) {
  const normalizedOrigin = origin?.toLowerCase() || "";

  if (normalizedOrigin.includes("planmyworkday")) {
    return {
      clientId: process.env.PLANMYWORKDAY_GOOGLE_CLIENT_ID || null,
      clientSecret: process.env.PLANMYWORKDAY_GOOGLE_CLIENT_SECRET || null,
    };
  }

  if (normalizedOrigin.includes("painpulse")) {
    return {
      clientId: process.env.PAINPULSE_GOOGLE_CLIENT_ID || null,
      clientSecret: process.env.PAINPULSE_GOOGLE_CLIENT_SECRET || null,
    };
  }

  return {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  };
}

function getGoogleRedirectUri(origin: string) {
  const normalizedOrigin = origin.toLowerCase();
  if (normalizedOrigin.includes("planmyworkday") || normalizedOrigin.includes("painpulse")) {
    return `${origin}/api/auth/google/callback`;
  }
  return process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || `${origin}/api/auth/google/callback`;
}

export function sanitizeAuthRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const parsed = new URL(value, "http://local.planmyworkday");
    const pathWithSearch = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (parsed.pathname === "/sign-in" || parsed.pathname.startsWith("/api/")) {
      return DEFAULT_AUTH_REDIRECT;
    }

    if (parsed.pathname === "/app" || parsed.pathname.startsWith("/app/")) {
      return pathWithSearch;
    }

    if (["/all-tasks", "/today", "/tomorrow", "/this-week"].includes(parsed.pathname)) {
      return pathWithSearch;
    }
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }

  return DEFAULT_AUTH_REDIRECT;
}

export function isGoogleAuthConfigured(origin?: string | null) {
  const credentials = resolveGoogleCredentials(origin || process.env.GOOGLE_AUTH_ORIGIN || null);
  return Boolean(credentials.clientId && credentials.clientSecret);
}

export function isDevelopmentAuthEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH === "1";
}

function getCookieValueFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

export function getNamedCookie(request: Request, name: string) {
  return getCookieValueFromHeader(request.headers.get("cookie"), name);
}

async function getSessionUserRecordFromToken(token: string | null) {
  if (!token) return null;

  const tokenHash = sha256(token);
  const nowIso = new Date().toISOString();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      profilePicture: users.profilePicture,
      isAdmin: users.isAdmin,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, nowIso)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCurrentUserFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const token = getNamedCookie(request, SESSION_COOKIE_NAME);
  const record = await getSessionUserRecordFromToken(token);
  if (!record) return null;

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    image: record.image,
    profilePicture: record.profilePicture,
    isAdmin: record.isAdmin === 1,
    subscription: await getEffectiveSubscriptionForUser(record.id),
  };
}

export async function getCurrentUserIdFromRequest(request: Request): Promise<number> {
  const user = await getCurrentUserFromRequest(request);
  if (!user) throw new UnauthorizedError();
  return user.id;
}

async function upsertGoogleUser(profile: GoogleProfile) {
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(profile.email);
  const existingRows = await db
    .select()
    .from(users)
    .where(or(eq(users.googleId, profile.sub), eq(users.email, normalizedEmail)))
    .limit(1);

  const image = profile.picture ?? null;
  const name = profile.name ?? null;

  if (existingRows[0]) {
    const [updated] = await db
      .update(users)
      .set({
        email: normalizedEmail,
        name,
        image,
        googleId: profile.sub,
        profilePicture: image,
        authProvider: "google",
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, existingRows[0].id))
      .returning();

    await ensureDefaultWorkspace(updated.id);
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name,
      image,
      googleId: profile.sub,
      profilePicture: image,
      authProvider: "google",
      lastLoginAt: now,
      isAdmin: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await ensureDefaultWorkspace(created.id);
  return created;
}

async function createPendingSession(
  userId: number,
  options?: {
    userAgent?: string | null;
    ipAddress?: string | null;
  },
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);

  await db.insert(authSessions).values({
    userId,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    userAgent: options?.userAgent ?? null,
    ipAddress: options?.ipAddress ?? null,
  });

  return {
    token,
    expiresAt,
  };
}

export async function revokeSessionFromRequest(request: Request) {
  const token = getNamedCookie(request, SESSION_COOKIE_NAME);
  if (!token) return;
  await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
}

export function buildGoogleAuthorizationRequest(origin: string, redirectTo = DEFAULT_AUTH_REDIRECT) {
  if (!isGoogleAuthConfigured(origin)) {
    throw new Error("Google authentication is not configured.");
  }
  const credentials = resolveGoogleCredentials(origin);
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error("Google authentication is not configured.");
  }

  const state = randomBytes(24).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("redirect_uri", getGoogleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "offline");

  return {
    authUrl: url.toString(),
    state,
    redirectTo: sanitizeAuthRedirectPath(redirectTo),
  };
}

export async function completeGoogleLogin(
  params: {
    code: string;
    state: string;
    expectedState: string | null;
    redirectTo: string | null;
    origin: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  },
) {
  const credentials = resolveGoogleCredentials(params.origin);
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error("Google authentication is not configured.");
  }

  if (!params.expectedState || params.expectedState !== params.state) {
    throw new UnauthorizedError("Google sign-in state verification failed.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: params.code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: getGoogleRedirectUri(params.origin),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange Google authorization code.");
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new Error("Google did not return an access token.");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  if (!profileResponse.ok) {
    throw new Error("Failed to load Google profile.");
  }

  const profile = (await profileResponse.json()) as GoogleProfile;
  if (!profile.sub || !profile.email) {
    throw new Error("Google profile is missing required fields.");
  }

  const user = await upsertGoogleUser(profile);
  const session = await createPendingSession(user.id, {
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
  });

  return {
    redirectTo: sanitizeAuthRedirectPath(params.redirectTo),
    userId: user.id,
    session,
  };
}

export async function signInAsExistingUser(
  userId: number,
  options?: {
    userAgent?: string | null;
    ipAddress?: string | null;
  },
) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];

  if (!user) {
    throw new Error("User not found.");
  }

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({
      lastLoginAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  await ensureDefaultWorkspace(userId);
  return createPendingSession(userId, options);
}

export async function listRecentUsers(limit = 12) {
  return db.select().from(users).orderBy(desc(users.lastLoginAt), desc(users.updatedAt)).limit(limit);
}
