import * as jwt from "jsonwebtoken";

export type JwtSignPayload = Record<string, unknown>;

/**
 * Replaces @nestjs/jwt JwtService for access tokens.
 */
export class JwtHelper {
  constructor(
    private readonly secret: string,
    // Matches the UserSession window (SESSION_DAYS). Unchanged at 7 days, but it
    // no longer means a weekly logout: the session slides forward on every
    // request, so this is 7 days of INACTIVITY. An active student is never
    // signed out; an abandoned session on a shared computer closes itself.
    private readonly defaultExpiresIn: string | number = "7d"
  ) {}

  signAsync(payload: JwtSignPayload, options?: { expiresIn?: string | number }): Promise<string> {
    const expiresIn = (options?.expiresIn ?? this.defaultExpiresIn) as jwt.SignOptions["expiresIn"];
    return Promise.resolve(jwt.sign(payload, this.secret, { expiresIn }));
  }

  verifyAsync<T>(token: string): Promise<T> {
    return Promise.resolve(jwt.verify(token, this.secret) as T);
  }
}
