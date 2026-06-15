import { jwtDecrypt } from "jose";

export async function getSessionFromJWT(
  token: string,
): Promise<{ id: string; role: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(process.env["AUTH_SECRET"] ?? "");
    const { payload } = await jwtDecrypt(token, secret);
    return {
      id: (payload.sub ?? payload.id ?? "") as string,
      role: (payload.role as string) ?? "MEMBER",
      email: (payload.email as string) ?? "",
    };
  } catch {
    return null;
  }
}
