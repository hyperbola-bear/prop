import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { addresses, blocks } from "../../../../../../packages/db/schema";
import { db } from "../../../../lib/db";
import { jsonResponse, mapError, requireAuth } from "../../../../lib/route-helpers";

const resolveAddressSchema = z.object({
  block: z.string().trim().min(1),
  street: z.string().trim().min(1),
  postal: z.string().trim().optional().default(""),
  building: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  lat: z.string().trim().optional().default(""),
  lng: z.string().trim().optional().default("")
});

const HDB_TOWNS = [
  "ANG MO KIO",
  "BEDOK",
  "BISHAN",
  "BUKIT BATOK",
  "BUKIT MERAH",
  "BUKIT PANJANG",
  "CENTRAL",
  "CHOA CHU KANG",
  "CLEMENTI",
  "GEYLANG",
  "HOUGANG",
  "JURONG EAST",
  "JURONG WEST",
  "KALLANG/WHAMPOA",
  "MARINE PARADE",
  "PASIR RIS",
  "PUNGGOL",
  "QUEENSTOWN",
  "SEMBAWANG",
  "SENGKANG",
  "SERANGOON",
  "TAMPINES",
  "TOA PAYOH",
  "WOODLANDS",
  "YISHUN"
] as const;

function inferTown(input: string): string {
  const upper = input.toUpperCase();
  return HDB_TOWNS.find((town) => upper.includes(town)) ?? "CENTRAL";
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = resolveAddressSchema.parse(await request.json());
    const town = inferTown(`${body.street} ${body.address} ${body.building}`);
    const line1 =
      body.address ||
      [body.block, body.street, body.postal ? `Singapore ${body.postal}` : "Singapore"]
        .filter(Boolean)
        .join(" ");

    const [address] = await db
      .insert(addresses)
      .values({
        line1,
        block: body.block,
        street: body.street,
        building: body.building || null,
        postalCode: body.postal || null,
        town,
        latitude: body.lat || null,
        longitude: body.lng || null
      })
      .returning({ id: addresses.id });

    if (!address) {
      throw new Error("Failed to resolve address");
    }

    const [existingBlock] = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        and(
          eq(blocks.blockNo, body.block),
          eq(blocks.streetName, body.street),
          eq(blocks.town, town),
          isNull(blocks.deletedAt)
        )
      )
      .limit(1);

    const block =
      existingBlock ??
      (
        await db
          .insert(blocks)
          .values({
            addressId: address.id,
            blockNo: body.block,
            streetName: body.street,
            postalCode: body.postal || null,
            town
          })
          .returning({ id: blocks.id })
      )[0];

    if (!block) {
      throw new Error("Failed to resolve HDB block");
    }

    return jsonResponse({
      addressId: address.id,
      blockId: block.id,
      town
    });
  } catch (error) {
    return mapError(error);
  }
}
