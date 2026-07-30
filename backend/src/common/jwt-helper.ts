import * as jwt from "jsonwebtoken";

export type JwtSignPayload = Record<string, unknown>;

/**
 * Replaces @nestjs/jwt JwtService for access tokens.
 */
export class JwtHelper {
  constructor(
    private readonly secret: string,
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
