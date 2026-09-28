import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  CreateAdminSellerBody,
  CreateAdminSellerResponse,
  DeleteAdminSellerParams,
  GetAdminSellersResponse,
  GetCurrentUserResponse,
  GetLoginOptionsResponse,
  LoginBody,
  LoginResponse,
  UpdateAccountPasswordBody,
  UpdateAccountPasswordResponse,
  UpdateAccountProfileBody,
  UpdateAccountProfileResponse,
  UpdateAdminSellerBody,
  UpdateAdminSellerParams,
  UpdateAdminSellerResponse,
} from "@workspace/api-zod";
import { activitiesTable, db, usersTable } from "@workspace/db";
import { signedActivity } from "../lib/audit";

const router: IRouter = Router();
const COOKIE_NAME = "newtech_session";
const BOOTSTRAP_PASSWORD_HASH =
  "4ff7b68f3199ebf15731663f7806ea16:53cd28cb05f94c2485142444cee9f8898ab7387429b9dc39c2f2708b18c4368a2492442fc2f857a2e5d48c1e85ff2d3f19f676aa29b56871618ddb853c600613";
const SESSION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "seller";
  sessionVersion: number;
  expiresAt: number;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: SessionPayload;
    }
  }
}

function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isUniqueViolation(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  );
}

function authUserResponse(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role as "admin" | "seller",
  };
}

function sellerAccountResponse(user: typeof usersTable.$inferSelect) {
  return {
    ...authUserResponse(user),
    role: "seller" as const,
    createdAt: user.createdAt.toISOString(),
  };
}

function accountActivity(
  actor: SessionPayload,
  title: string,
  description: string,
) {
  return signedActivity(actor, {
    type: "account",
    title,
    description,
    amount: 0,
  });
}

function getSecret() {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is required");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function createSession(user: Omit<SessionPayload, "expiresAt">) {
  const payload: SessionPayload = {
    ...user,
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function setSessionCookie(
  res: Parameters<RequestHandler>[1],
  user: typeof usersTable.$inferSelect,
) {
  const role = user.role === "admin" ? "admin" : "seller";
  const cookie = [
    `${COOKIE_NAME}=${createSession({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role,
      sessionVersion: user.sessionVersion,
    })}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_SECONDS}`,
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

function readCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

function verifySession(token: string | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(encoded));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      !Number.isInteger(payload.id) ||
      !Number.isInteger(payload.sessionVersion) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    if (payload.role !== "admin" && payload.role !== "seller") return null;
    return payload;
  } catch {
    return null;
  }
}

let usersPromise: Promise<void> | undefined;

async function ensureUsers() {
  if (!usersPromise) {
    usersPromise = (async () => {
      const canonicalUsers = [
        {
          username: "المدير",
          displayName: "مدير النظام",
          role: "admin",
          passwordHash: BOOTSTRAP_PASSWORD_HASH,
        },
      ];
      for (const user of canonicalUsers) {
        const [existingRole] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.role, user.role))
          .limit(1);
        if (!existingRole) {
          await db
            .insert(usersTable)
            .values(user)
            .onConflictDoNothing({ target: usersTable.username });
        }
      }
    })();
  }
  await usersPromise;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = verifySession(readCookie(req.headers.cookie));
  if (!session) {
    res.status(401).json({ error: "يرجى تسجيل الدخول" });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.id))
      .limit(1);
    if (
      !user ||
      user.username !== session.username ||
      user.role !== session.role ||
      user.sessionVersion !== session.sessionVersion ||
      (user.role !== "admin" && user.role !== "seller")
    ) {
      res.status(401).json({ error: "انتهت صلاحية الجلسة" });
      return;
    }
    req.authUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      sessionVersion: user.sessionVersion,
      expiresAt: session.expiresAt,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.authUser?.role !== "admin") {
    res.status(403).json({ error: "هذه العملية متاحة للمدير فقط" });
    return;
  }
  next();
};

router.get("/auth/login-options", async (_req, res, next): Promise<void> => {
  try {
    await ensureUsers();
    const accounts = await db
      .select({
        username: usersTable.username,
        displayName: usersTable.displayName,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "seller"]))
      .orderBy(asc(usersTable.role), asc(usersTable.displayName), asc(usersTable.username));
    res.json(GetLoginOptionsResponse.parse(accounts));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    await ensureUsers();
    const body = LoginBody.parse(req.body);
    const username = normalizeUsername(body.username);
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (!user && username === "admin") {
      [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, "المدير"))
        .limit(1);
    }
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }
    if (user.role !== "admin" && user.role !== "seller") {
      res.status(401).json({ error: "الحساب غير معتمد" });
      return;
    }
    setSessionCookie(res, user);
    res.json(LoginResponse.parse({ user: authUserResponse(user) }));
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/auth/account",
  requireAuth,
  requireAdmin,
  async (req, res, next): Promise<void> => {
    const parsed = UpdateAccountProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "أدخل اسم مستخدم واسماً ظاهراً صالحين." });
      return;
    }
    const normalized = UpdateAccountProfileBody.safeParse({
      username: normalizeUsername(parsed.data.username),
      displayName: parsed.data.displayName.trim(),
    });
    if (!normalized.success) {
      res.status(400).json({ error: "تأكد من طول اسم المستخدم والاسم الظاهر." });
      return;
    }
    try {
      const currentUser = req.authUser!;
      const updated = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(usersTable)
          .set({
            username: normalized.data.username,
            displayName: normalized.data.displayName,
            sessionVersion: sql`${usersTable.sessionVersion} + 1`,
          })
          .where(
            and(
              eq(usersTable.id, currentUser.id),
              eq(usersTable.sessionVersion, currentUser.sessionVersion),
            ),
          )
          .returning();
        if (updated) {
          await tx.insert(activitiesTable).values(
            accountActivity(
              currentUser,
              "تحديث بيانات الحساب",
              "تم تحديث بيانات حساب المدير",
            ),
          );
        }
        return updated;
      });
      if (!updated) {
        res.status(409).json({ error: "تغيّرت بيانات الجلسة. سجّل الدخول مجدداً." });
        return;
      }
      setSessionCookie(res, updated);
      res.json(
        UpdateAccountProfileResponse.parse(authUserResponse(updated)),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل." });
        return;
      }
      next(error);
    }
  },
);

router.put(
  "/auth/account/password",
  requireAuth,
  requireAdmin,
  async (req, res, next): Promise<void> => {
    const parsed = UpdateAccountPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." });
      return;
    }
    try {
      const currentUser = req.authUser!;
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, currentUser.id))
        .limit(1);
      if (!user || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
        res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة." });
        return;
      }
      if (parsed.data.currentPassword === parsed.data.newPassword) {
        res.status(400).json({ error: "اختر كلمة مرور جديدة مختلفة عن الحالية." });
        return;
      }
      const updated = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(usersTable)
          .set({
            passwordHash: hashPassword(parsed.data.newPassword),
            sessionVersion: sql`${usersTable.sessionVersion} + 1`,
          })
          .where(
            and(
              eq(usersTable.id, currentUser.id),
              eq(usersTable.sessionVersion, currentUser.sessionVersion),
            ),
          )
          .returning();
        if (updated) {
          await tx.insert(activitiesTable).values(
            accountActivity(
              currentUser,
              "تغيير كلمة المرور",
              "تم تغيير كلمة مرور حساب المدير",
            ),
          );
        }
        return updated;
      });
      if (!updated) {
        res.status(409).json({ error: "تغيّرت بيانات الجلسة. سجّل الدخول مجدداً." });
        return;
      }
      setSessionCookie(res, updated);
      res.json(
        UpdateAccountPasswordResponse.parse(authUserResponse(updated)),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/auth/admin/sellers",
  requireAuth,
  requireAdmin,
  async (_req, res, next): Promise<void> => {
    try {
      const sellers = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.role, "seller"))
        .orderBy(asc(usersTable.displayName), asc(usersTable.username));
      res.json(
        GetAdminSellersResponse.parse(sellers.map(sellerAccountResponse)),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/auth/admin/sellers",
  requireAuth,
  requireAdmin,
  async (req, res, next): Promise<void> => {
    const parsed = CreateAdminSellerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "أكمل بيانات البايع، واستخدم كلمة مرور من 8 أحرف على الأقل." });
      return;
    }
    const normalized = CreateAdminSellerBody.safeParse({
      ...parsed.data,
      username: normalizeUsername(parsed.data.username),
      displayName: parsed.data.displayName.trim(),
    });
    if (!normalized.success) {
      res.status(400).json({ error: "تأكد من طول اسم المستخدم والاسم الظاهر." });
      return;
    }
    try {
      const created = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(usersTable)
          .values({
            username: normalized.data.username,
            displayName: normalized.data.displayName,
            role: "seller",
            passwordHash: hashPassword(normalized.data.password),
          })
          .onConflictDoNothing({ target: usersTable.username })
          .returning();
        if (created) {
          await tx.insert(activitiesTable).values(
            accountActivity(
              req.authUser!,
              "إنشاء حساب بائع",
              `تم إنشاء حساب ${created.displayName} (${created.username})`,
            ),
          );
        }
        return created;
      });
      if (!created) {
        res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل." });
        return;
      }
      res
        .status(201)
        .json(CreateAdminSellerResponse.parse(sellerAccountResponse(created)));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/auth/admin/sellers/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsedParams = UpdateAdminSellerParams.safeParse({
      id: Number(rawId),
    });
    if (!parsedParams.success) {
      res.status(400).json({ error: "معرّف حساب البايع غير صالح." });
      return;
    }
    const parsed = UpdateAdminSellerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "أدخل اسم مستخدم واسماً ظاهراً صالحين." });
      return;
    }
    const normalized = UpdateAdminSellerBody.safeParse({
      username: normalizeUsername(parsed.data.username),
      displayName: parsed.data.displayName.trim(),
    });
    if (!normalized.success) {
      res.status(400).json({ error: "تأكد من طول اسم المستخدم والاسم الظاهر." });
      return;
    }
    try {
      const updated = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(usersTable)
          .set({
            username: normalized.data.username,
            displayName: normalized.data.displayName,
            sessionVersion: sql`${usersTable.sessionVersion} + 1`,
          })
          .where(
            and(
              eq(usersTable.id, parsedParams.data.id),
              eq(usersTable.role, "seller"),
            ),
          )
          .returning();
        if (updated) {
          await tx.insert(activitiesTable).values(
            accountActivity(
              req.authUser!,
              "تحديث حساب بائع",
              `تم تعديل بيانات حساب البائع ${updated.displayName} (${updated.username})`,
            ),
          );
        }
        return updated;
      });
      if (!updated) {
        res.status(404).json({ error: "حساب البايع غير موجود." });
        return;
      }
      res.json(UpdateAdminSellerResponse.parse(sellerAccountResponse(updated)));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل." });
        return;
      }
      next(error);
    }
  },
);

router.delete(
  "/auth/admin/sellers/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsedParams = DeleteAdminSellerParams.safeParse({
      id: Number(rawId),
    });
    if (!parsedParams.success) {
      res.status(400).json({ error: "معرّف حساب البايع غير صالح." });
      return;
    }
    try {
      const actor = req.authUser!;
      const deleted = await db.transaction(async (tx) => {
        const [seller] = await tx
          .select({
            id: usersTable.id,
            username: usersTable.username,
            displayName: usersTable.displayName,
          })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.id, parsedParams.data.id),
              eq(usersTable.role, "seller"),
            ),
          )
          .limit(1);
        if (!seller) return false;

        const [removed] = await tx
          .delete(usersTable)
          .where(
            and(
              eq(usersTable.id, seller.id),
              eq(usersTable.role, "seller"),
            ),
          )
          .returning({ id: usersTable.id });
        if (!removed) return false;

        await tx.insert(activitiesTable).values(
          accountActivity(
            actor,
            "حذف حساب بائع",
            `تم حذف حساب ${seller.displayName} (${seller.username}) مع الإبقاء على سجلاته`,
          ),
        );
        return true;
      });
      if (!deleted) {
        res.status(404).json({ error: "حساب البايع غير موجود." });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.get("/auth/me", requireAuth, (req, res) => {
  const user = req.authUser!;
  res.json(
    GetCurrentUserResponse.parse({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    }),
  );
});

router.post("/auth/logout", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  res.json({ success: true });
});

export default router;