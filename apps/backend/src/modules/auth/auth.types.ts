export interface JwtAccessPayload {
  sub: string;
  email: string;
  type: 'access';
  roles: string[];
  permissions: string[];
  /** Customer-facing full name (profile or saved address). */
  displayName: string;
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}
