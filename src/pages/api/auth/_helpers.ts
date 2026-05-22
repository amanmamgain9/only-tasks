import type { NextApiRequest } from "next";

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
  expires?: Date;
};

export function resolveOrigin(req: NextApiRequest) {
  const forwardedHost = typeof req.headers["x-forwarded-host"] === "string" ? req.headers["x-forwarded-host"] : null;
  const host = forwardedHost || req.headers.host;
  const normalizedHost = host?.toLowerCase() || "";
  const proto =
    normalizedHost.includes("planmyworkday.dev")
      ? "https"
      : typeof req.headers["x-forwarded-proto"] === "string"
        ? req.headers["x-forwarded-proto"]
        : "http";
  return `${proto}://${host}`;
}

export function toWebRequest(req: NextApiRequest) {
  const origin = resolveOrigin(req);
  const headers = new Headers();

  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers.set(key, value);
      return;
    }
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  });

  return new Request(`${origin}${req.url || ""}`, {
    method: req.method || "GET",
    headers,
  });
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}

export function expireCookie(name: string) {
  return serializeCookie(name, "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
