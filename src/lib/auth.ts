import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { one, run } from "./db";
import type { User } from "./types";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export async function currentUser(): Promise<User | null> {
    const token = (await cookies()).get("mindspine_session")?.value;
    if (!token)
        return null;
    return (await one<User>("SELECT u.id,u.name,u.email,u.role,u.specialty,u.active,u.phone,u.history,u.created_at FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1", digest(token), Date.now()) ?? null);
}
export async function requireUser() {
    const user = await currentUser();
    if (!user)
        throw new Error("Please sign in to continue.");
    return user;
}
export async function createSession(userId: string) {
    const token = randomBytes(32).toString("hex");
    await run("DELETE FROM sessions WHERE expires_at < ?", Date.now());
    await run("INSERT INTO sessions VALUES (?,?,?)", digest(token), userId, Date.now() + 8 * 60 * 60 * 1000);
    (await cookies()).set("mindspine_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" &&
            process.env.COOKIE_SECURE !== "false",
        maxAge: 8 * 60 * 60,
        path: "/",
    });
}
export async function destroySession() {
    const c = await cookies();
    const token = c.get("mindspine_session")?.value;
    if (token)
        await run("DELETE FROM sessions WHERE token=?", digest(token));
    c.delete("mindspine_session");
}
