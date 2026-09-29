export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_ERROR'
  | 'PAYMENT_ERROR'
  | 'INVENTORY_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: AppErrorCode;
  readonly details?: unknown[];

  constructor(
    message: string,
    statusCode: number,
    code: AppErrorCode,
    details?: unknown[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown[]) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown[]) {
    super(message, 422, 'BUSINESS_RULE_ERROR', details);
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: unknown[]) {
    super(message, 402, 'PAYMENT_ERROR', details);
  }
}

export class InventoryError extends AppError {
  constructor(message: string, details?: unknown[]) {
    super(message, 409, 'INVENTORY_ERROR', details);
  }
}
