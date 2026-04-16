/**
 * Type của user được inject bởi JwtStrategy sau khi validate JWT
 */
export interface JwtUser {
  userId: string;
  email: string;
  role: string;
}
