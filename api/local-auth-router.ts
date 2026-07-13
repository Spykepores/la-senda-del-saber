import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { env } from "./lib/env";
import {
  findLocalUserByEmail,
  findLocalUserByPhone,
  createLocalUser,
  updateLocalUserLastSignIn,
} from "./queries/localUsers";

const secret = new TextEncoder().encode(env.appSecret);

async function createToken(user: { id: number; name: string; email?: string | null; phone?: string | null; role: string }) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      if (!input.email && !input.phone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email o telefono requerido" });
      }

      const existingEmail = input.email ? await findLocalUserByEmail(input.email) : null;
      const existingPhone = input.phone ? await findLocalUserByPhone(input.phone) : null;

      if (existingEmail || existingPhone) {
        throw new TRPCError({ code: "CONFLICT", message: "Usuario ya existe" });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await createLocalUser({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: "user",
      });

      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al crear usuario" });
      }

      const token = await createToken(user);
      return { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (!input.email && !input.phone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email o telefono requerido" });
      }

      const user = input.email
        ? await findLocalUserByEmail(input.email)
        : await findLocalUserByPhone(input.phone!);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Password incorrecto" });
      }

      await updateLocalUserLastSignIn(user.id);

      const token = await createToken(user);
      return { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } };
    }),
});
