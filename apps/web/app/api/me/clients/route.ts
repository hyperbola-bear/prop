import { NextRequest } from "next/server";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { userRoles, users } from "../../../../../../packages/db/schema";
import { db } from "../../../../lib/db";
import { ForbiddenError, jsonResponse, mapError, requireAuth } from "../../../../lib/route-helpers";

const createClientSchema = z.object({
  email: z.email()
});

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    if (!currentUser.roles.includes("agent")) {
      throw new ForbiddenError("Agent role required");
    }

    const query = request.nextUrl.searchParams.get("q")?.trim();
    const pattern = query ? `%${query}%` : "%";
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phoneE164,
        name: users.name
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.role, "seller"),
          isNull(users.deletedAt),
          isNull(userRoles.deletedAt),
          query
            ? or(ilike(users.email, pattern), ilike(users.phoneE164, pattern), ilike(users.name, pattern))
            : undefined
        )
      )
      .limit(20);

    return jsonResponse({ items: rows });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    if (!currentUser.roles.includes("agent")) {
      throw new ForbiddenError("Agent role required");
    }
    const body = createClientSchema.parse(await request.json());
    const phone = `+65${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

    const [created] = await db
      .insert(users)
      .values({
        email: body.email,
        name: body.email,
        phoneE164: phone
      })
      .returning({ id: users.id, email: users.email, phone: users.phoneE164, name: users.name });

    if (!created) {
      throw new Error("Failed to create pending seller");
    }

    await db.insert(userRoles).values({
      userId: created.id,
      role: "seller"
    });

    return jsonResponse(created, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
