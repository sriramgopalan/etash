export interface CreateUserInput {
  email: string;
  passwordHash?: string;
  name?: string;
  image?: string;
  emailVerified?: Date;
}

export interface SafeUser {
  id: string;
  email: string;
  emailVerified: Date | null;
  name: string | null;
  image: string | null;
  createdAt: Date;
}
