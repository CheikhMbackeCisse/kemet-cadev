export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export const unauthorized = () => new AppError("unauthorized", "Authentification requise.", 401);

export const notFound = (message: string) => new AppError("not_found", message, 404);

export const conflict = (message: string) => new AppError("conflict", message, 409);

export const badRequest = (message: string) => new AppError("bad_request", message, 400);
