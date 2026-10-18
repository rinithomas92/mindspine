import { z } from "zod";

const credentials = {
  email: z.string().trim().max(200).pipe(z.email("Enter a valid email address.")).transform(value => value.toLowerCase()),
  password: z.string().min(1, "Enter your password.").max(15, "Password must be 15 characters or fewer."),
};

export const authInput = z.discriminatedUnion("register", [
  z.object({ ...credentials, register: z.literal(false), portal: z.enum(["patient","psychologist","physiotherapist","admin"]).optional() }),
  z.object({
    ...credentials,
    register: z.literal(true),
    name: z.string().trim().min(1, "Enter your full name.").max(100),
    password: z.string().min(8, "Use at least 8 characters, including letters and numbers.").max(15, "Password must be 15 characters or fewer.").regex(/^(?=.*[A-Za-z])(?=.*\d)/, "Use at least 8 characters, including letters and numbers."),
  }),
]);

export function matchesPortal(user: {role:string;specialty?:string}, portal?:string) {
  if(!portal)return true;
  return portal==='psychologist'||portal==='physiotherapist' ? user.role==='practitioner' && user.specialty===portal : user.role===portal;
}
