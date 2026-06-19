// lib/errors.ts

export class AppError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const unauthorized = () =>
  new AppError("UNAUTHORIZED", 401, "Authentication required");

export const forbidden = () =>
  new AppError("FORBIDDEN", 403, "Access denied");

export const notFound = () =>
  new AppError("NOT_FOUND", 404, "Resource not found");

export const badRequest = () =>
  new AppError("BAD_REQUEST", 400, "Bad request");

export const serverError = () =>
  new AppError("SERVER_ERROR", 500, "Internal server error");