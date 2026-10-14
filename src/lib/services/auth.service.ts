import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getConfig } from "@/lib/config";
import { signToken } from "@/lib/jwt";
import {
  createUser,
  findUserByEmail,
  type PublicUser,
} from "@/lib/repositories/user.repository";

// Hash factice comparé quand l'email est inconnu : même coût bcrypt que les vrais hashes,
// pour que la réponse prenne le même temps (on ne peut pas deviner quels emails existent).
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), getConfig().bcryptSaltRounds);
  return dummyHash;
}

export class AuthError extends Error {
  constructor(public readonly code: "INVALID_CREDENTIALS" | "EMAIL_TAKEN") {
    super(code);
  }
}

export type AuthResult = { token: string; user: PublicUser };

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  const valid = await bcrypt.compare(password, user?.password_hash ?? (await getDummyHash()));

  if (!user || !user.password_hash || !valid) throw new AuthError("INVALID_CREDENTIALS");

  const { id, username, display_name, avatar_url, avatar_seed } = user;
  return createSession({ id, username, display_name, avatar_url, avatar_seed });
}

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  if (await findUserByEmail(email)) throw new AuthError("EMAIL_TAKEN");

  const user = await createUser({
    email,
    username: makeUsername(name),
    display_name: name,
    password_hash: await bcrypt.hash(password, getConfig().bcryptSaltRounds),
  });

  return createSession(user);
}

async function createSession(user: PublicUser): Promise<AuthResult> {
  const token = await signToken(user.id);
  return { token, user };
}

function makeUsername(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20) || "user";

  return `${base}_${randomBytes(3).toString("hex")}`;
}
