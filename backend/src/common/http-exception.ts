/** Drop-in replacements for NestJS-style HTTP exceptions (used by Express routes and domain services). */

export const HttpStatus = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429
} as const;

export class HttpException extends Error {
  constructor(
    private readonly responseBody: string | Record<string, unknown>,
    private readonly statusCode: number
  ) {
    super(typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody));
    this.name = "HttpException";
  }

  getStatus(): number {
    return this.statusCode;
  }

  getResponse(): string | Record<string, unknown> {
    return this.responseBody;
  }
}

function msgBody(message: string | Record<string, unknown>, status: number): Record<string, unknown> {
  return typeof message === "string"
    ? { statusCode: status, message }
    : { statusCode: status, ...message };
}

export class BadRequestException extends HttpException {
  constructor(message: string | Record<string, unknown> = "Bad Request") {
    super(msgBody(message, HttpStatus.BAD_REQUEST), HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string | Record<string, unknown> = "Unauthorized") {
    super(msgBody(message, HttpStatus.UNAUTHORIZED), HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string | Record<string, unknown> = "Forbidden") {
    super(msgBody(message, HttpStatus.FORBIDDEN), HttpStatus.FORBIDDEN);
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string | Record<string, unknown> = "Not Found") {
    super(msgBody(message, HttpStatus.NOT_FOUND), HttpStatus.NOT_FOUND);
  }
}
