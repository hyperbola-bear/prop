import { createReadStream, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import postgres from "postgres";
import {
  hashSeedPassword,
  parseCEACsv,
  parseMrtStationsCsv,
  slugify,
  stableUuid
} from "./helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const dataDir = join(__dirname, "data");
const photosDir = join(__dirname, "photos");
const snapshotAt = "2026-01-01T00:00:00.000Z";

type SeedUser = {
  email: string;
  name: string;
  role: "admin" | "agent" | "seller" | "buyer";
  phone: string;
};

type ListingSeed = {
  fixtureNo: number;
  ownerEmail: string;
  agentEmail?: string;
  town: string;
  block: string;
  street: string;
  postal: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  priceCents: bigint;
  bedrooms: number;
  bathrooms: number;
  flatType: "3-room" | "4-room" | "5-room" | "Executive";
  floorAreaSqft: number;
  floorLevelBand: "low" | "mid" | "high";
  leaseMonths: 12 | 24;
  availableFrom: string;
  furnishing: "Unfurnished" | "Partial" | "Fully";
};

const seedUsers: SeedUser[] = [
  { email: "admin@proppy.test", name: "Proppy Admin", role: "admin", phone: "+6580000000" },
  { email: "agent1@proppy.test", name: "Alicia Tan", role: "agent", phone: "+6580000001" },
  { email: "agent2@proppy.test", name: "Benedict Lim", role: "agent", phone: "+6580000002" },
  { email: "landlord1@proppy.test", name: "Landlord One", role: "seller", phone: "+6580000003" },
  { email: "landlord2@proppy.test", name: "Landlord Two", role: "seller", phone: "+6580000004" },
  { email: "renter1@proppy.test", name: "Renter One", role: "buyer", phone: "+6580000005" },
  { email: "renter2@proppy.test", name: "Renter Two", role: "buyer", phone: "+6580000006" }
];

const listings: ListingSeed[] = [
  {
    fixtureNo: 1,
    ownerEmail: "landlord1@proppy.test",
    agentEmail: "agent1@proppy.test",
    town: "TAMPINES",
    block: "857",
    street: "Tampines Street 83",
    postal: "520857",
    lat: 1.3509,
    lng: 103.9362,
    title: "Sunny 4-room HDB near Tampines MRT with balcony",
    description: "Bright whole-unit rental with a breezy balcony, renovated kitchen, and quick access to Tampines MRT.",
    priceCents: 360000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "4-room",
    floorAreaSqft: 990,
    floorLevelBand: "mid",
    leaseMonths: 24,
    availableFrom: "2026-06-01",
    furnishing: "Fully"
  },
  {
    fixtureNo: 2,
    ownerEmail: "landlord1@proppy.test",
    town: "TOA PAYOH",
    block: "79A",
    street: "Toa Payoh Central",
    postal: "311079",
    lat: 1.3341,
    lng: 103.8485,
    title: "Central 3-room HDB steps from Toa Payoh amenities",
    description: "Compact and convenient home near buses, supermarket, hawker food, and the MRT.",
    priceCents: 280000n,
    bedrooms: 2,
    bathrooms: 1,
    flatType: "3-room",
    floorAreaSqft: 710,
    floorLevelBand: "high",
    leaseMonths: 12,
    availableFrom: "2026-06-10",
    furnishing: "Partial"
  },
  {
    fixtureNo: 3,
    ownerEmail: "landlord1@proppy.test",
    town: "BEDOK",
    block: "205",
    street: "Bedok North Street 1",
    postal: "460205",
    lat: 1.3275,
    lng: 103.9293,
    title: "Spacious 5-room family HDB near Bedok Mall",
    description: "Large living area, family-friendly estate, and a short walk to Bedok MRT and dining options.",
    priceCents: 410000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "5-room",
    floorAreaSqft: 1180,
    floorLevelBand: "mid",
    leaseMonths: 24,
    availableFrom: "2026-06-15",
    furnishing: "Fully"
  },
  {
    fixtureNo: 4,
    ownerEmail: "landlord1@proppy.test",
    town: "BISHAN",
    block: "152",
    street: "Bishan Street 11",
    postal: "570152",
    lat: 1.3468,
    lng: 103.8509,
    title: "Quiet 4-room HDB beside Bishan park connector",
    description: "Calm estate with greenery, strong transport links, and a practical layout for work-from-home.",
    priceCents: 390000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "4-room",
    floorAreaSqft: 1010,
    floorLevelBand: "low",
    leaseMonths: 24,
    availableFrom: "2026-07-01",
    furnishing: "Partial"
  },
  {
    fixtureNo: 5,
    ownerEmail: "landlord2@proppy.test",
    town: "JURONG WEST",
    block: "682C",
    street: "Jurong West Central 1",
    postal: "643682",
    lat: 1.3418,
    lng: 103.7057,
    title: "Executive HDB near Boon Lay and Jurong Point",
    description: "Generous executive apartment with study corner, updated bathrooms, and doorstep amenities.",
    priceCents: 430000n,
    bedrooms: 4,
    bathrooms: 2,
    flatType: "Executive",
    floorAreaSqft: 1200,
    floorLevelBand: "high",
    leaseMonths: 24,
    availableFrom: "2026-06-20",
    furnishing: "Fully"
  },
  {
    fixtureNo: 6,
    ownerEmail: "landlord2@proppy.test",
    agentEmail: "agent1@proppy.test",
    town: "PUNGGOL",
    block: "310A",
    street: "Punggol Walk",
    postal: "821310",
    lat: 1.4058,
    lng: 103.9028,
    title: "Modern 4-room HDB near Punggol Waterway",
    description: "Newer estate home with open views, full furnishing, and quick LRT/MRT connections.",
    priceCents: 380000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "4-room",
    floorAreaSqft: 960,
    floorLevelBand: "mid",
    leaseMonths: 12,
    availableFrom: "2026-06-25",
    furnishing: "Fully"
  },
  {
    fixtureNo: 7,
    ownerEmail: "landlord2@proppy.test",
    town: "YISHUN",
    block: "744",
    street: "Yishun Street 72",
    postal: "760744",
    lat: 1.4278,
    lng: 103.8315,
    title: "Cozy 3-room HDB close to Yishun MRT",
    description: "Efficient layout, airy bedrooms, and convenient access to Northpoint City.",
    priceCents: 260000n,
    bedrooms: 2,
    bathrooms: 1,
    flatType: "3-room",
    floorAreaSqft: 690,
    floorLevelBand: "mid",
    leaseMonths: 12,
    availableFrom: "2026-07-05",
    furnishing: "Unfurnished"
  },
  {
    fixtureNo: 8,
    ownerEmail: "landlord2@proppy.test",
    town: "ANG MO KIO",
    block: "532",
    street: "Ang Mo Kio Avenue 10",
    postal: "560532",
    lat: 1.3731,
    lng: 103.8542,
    title: "Renovated 4-room HDB near Ang Mo Kio hub",
    description: "Tastefully renovated home near markets, schools, parks, and direct city trains.",
    priceCents: 350000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "4-room",
    floorAreaSqft: 980,
    floorLevelBand: "high",
    leaseMonths: 24,
    availableFrom: "2026-06-08",
    furnishing: "Partial"
  },
  {
    fixtureNo: 9,
    ownerEmail: "landlord1@proppy.test",
    agentEmail: "agent1@proppy.test",
    town: "QUEENSTOWN",
    block: "48",
    street: "Strathmore Avenue",
    postal: "141048",
    lat: 1.2932,
    lng: 103.8083,
    title: "City-fringe 4-room HDB in Queenstown",
    description: "Well-kept apartment with fast access to CBD, Alexandra, and Holland Village.",
    priceCents: 400000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "4-room",
    floorAreaSqft: 1005,
    floorLevelBand: "mid",
    leaseMonths: 12,
    availableFrom: "2026-07-10",
    furnishing: "Fully"
  },
  {
    fixtureNo: 10,
    ownerEmail: "landlord2@proppy.test",
    town: "BUKIT BATOK",
    block: "291B",
    street: "Bukit Batok Street 24",
    postal: "652291",
    lat: 1.3444,
    lng: 103.7558,
    title: "Green-view 5-room HDB in Bukit Batok",
    description: "Spacious home with leafy views, good natural light, and nearby neighborhood amenities.",
    priceCents: 370000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "5-room",
    floorAreaSqft: 1120,
    floorLevelBand: "low",
    leaseMonths: 24,
    availableFrom: "2026-06-18",
    furnishing: "Partial"
  },
  {
    fixtureNo: 11,
    ownerEmail: "landlord1@proppy.test",
    town: "PASIR RIS",
    block: "571",
    street: "Pasir Ris Street 53",
    postal: "510571",
    lat: 1.3744,
    lng: 103.9465,
    title: "Breezy 4-room HDB near Pasir Ris Park",
    description: "Relaxed east-side living with park access, cross-ventilation, and family-friendly facilities.",
    priceCents: 340000n,
    bedrooms: 3,
    bathrooms: 2,
    flatType: "4-room",
    floorAreaSqft: 970,
    floorLevelBand: "mid",
    leaseMonths: 12,
    availableFrom: "2026-07-15",
    furnishing: "Fully"
  },
  {
    fixtureNo: 12,
    ownerEmail: "landlord2@proppy.test",
    town: "BUKIT MERAH",
    block: "116",
    street: "Bukit Merah View",
    postal: "151116",
    lat: 1.2854,
    lng: 103.8219,
    title: "Central 3-room HDB near Tiong Bahru",
    description: "Affordable city-fringe unit with fast bus links, hawker food, and practical furnishing.",
    priceCents: 300000n,
    bedrooms: 2,
    bathrooms: 1,
    flatType: "3-room",
    floorAreaSqft: 720,
    floorLevelBand: "high",
    leaseMonths: 12,
    availableFrom: "2026-06-30",
    furnishing: "Partial"
  }
];

function listingIdentity(listing: ListingSeed): string {
  return [listing.fixtureNo, listing.town, listing.block, listing.title].join(":");
}

function readDotEnv(): Record<string, string> {
  try {
    const text = readFileSync(join(repoRoot, ".env"), "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const [envName, ...value] = line.split("=");
          return [envName, value.join("=")];
        })
    );
  } catch {
    return {};
  }
}

const dotEnv = readDotEnv();

function env(name: string, fallback: string): string {
  return process.env[name] ?? dotEnv[name] ?? fallback;
}

async function ensureBucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (!["BucketAlreadyExists", "BucketAlreadyOwnedByYou"].includes(name)) {
        throw error;
      }
    }
  }
}

async function upsertUsers(sql: postgres.Sql): Promise<Map<string, string>> {
  const passwordHash = await hashSeedPassword();
  const userIds = new Map<string, string>();

  for (const user of seedUsers) {
    const id = stableUuid(`user:${user.email}`);
    const [row] = await sql<{ id: string }[]>`
      insert into users (id, email, name, phone_e164, password_hash, phone_verified_at, pdpa_consent_at)
      values (${id}, ${user.email}, ${user.name}, ${user.phone}, ${passwordHash}, now(), now())
      on conflict (email) do update set
        name = excluded.name,
        phone_e164 = excluded.phone_e164,
        password_hash = excluded.password_hash,
        phone_verified_at = coalesce(users.phone_verified_at, excluded.phone_verified_at),
        pdpa_consent_at = coalesce(users.pdpa_consent_at, excluded.pdpa_consent_at),
        updated_at = now()
      returning id
    `;
    if (!row) {
      throw new Error(`Failed to upsert fixture user ${user.email}`);
    }
    userIds.set(user.email, row.id);

    await sql`
      insert into user_roles (id, user_id, role)
      values (${stableUuid(`role:${user.email}:${user.role}`)}, ${row.id}, ${user.role})
      on conflict (user_id, role) do update set updated_at = now()
    `;

    if (user.role === "buyer") {
      await sql`
        insert into buyer_profiles (id, user_id, preferred_name, preferred_contact_method)
        values (${stableUuid(`buyer-profile:${user.email}`)}, ${row.id}, ${user.name}, 'email')
        on conflict (id) do update set
          preferred_name = excluded.preferred_name,
          updated_at = now()
      `;
    }

    if (user.role === "seller") {
      await sql`
        insert into seller_profiles (id, user_id, display_name, preferred_contact_method)
        values (${stableUuid(`seller-profile:${user.email}`)}, ${row.id}, ${user.name}, 'email')
        on conflict (id) do update set
          display_name = excluded.display_name,
          updated_at = now()
      `;
    }
  }

  return userIds;
}

async function seedCea(sql: postgres.Sql): Promise<void> {
  const csv = await readFile(join(dataDir, "cea_register.csv"), "utf8");
  for (const row of parseCEACsv(csv)) {
    await sql`
      insert into external.cea_register_snapshots (
        registration_no, name, agency_name, agency_licence_no, status,
        first_registered_date, snapshot_at, source_payload
      )
      values (
        ${row.registrationNo}, ${row.name}, ${row.agencyName}, ${row.agencyLicenceNo},
        ${row.status}, ${row.firstRegisteredDate}, ${snapshotAt},
        ${JSON.stringify({ seed: true, registration_no: row.registrationNo })}
      )
      on conflict (registration_no, snapshot_at) do update set
        name = excluded.name,
        agency_name = excluded.agency_name,
        agency_licence_no = excluded.agency_licence_no,
        status = excluded.status,
        first_registered_date = excluded.first_registered_date,
        updated_at = now()
    `;
  }
}

async function seedAgentProfiles(sql: postgres.Sql, userIds: Map<string, string>): Promise<void> {
  const agent1Id = userIds.get("agent1@proppy.test");
  const agent2Id = userIds.get("agent2@proppy.test");
  if (!agent1Id || !agent2Id) {
    throw new Error("Agent fixture users were not created");
  }

  await sql`
    insert into agent_profiles (
      id, user_id, cea_registration_no, cea_status, agency_name, agency_licence_no,
      bio, specialties, languages, verified_at
    )
    select
      ${stableUuid("agent-profile:agent1@proppy.test")},
      ${agent1Id},
      registration_no,
      status,
      agency_name,
      agency_licence_no,
      'CEA-verified HDB rental specialist focused on east and central Singapore.',
      array['HDB rentals', 'Tenant matching'],
      array['English', 'Mandarin'],
      now()
    from external.cea_register_snapshots
    where registration_no = 'R012345A'
    limit 1
    on conflict (user_id) do update set
      cea_registration_no = excluded.cea_registration_no,
      cea_status = excluded.cea_status,
      agency_name = excluded.agency_name,
      agency_licence_no = excluded.agency_licence_no,
      verified_at = coalesce(agent_profiles.verified_at, excluded.verified_at),
      updated_at = now()
  `;

  await sql`
    insert into agent_profiles (
      id, user_id, cea_registration_no, cea_status, agency_name,
      bio, specialties, languages, verified_at
    )
    values (
      ${stableUuid("agent-profile:agent2@proppy.test")},
      ${agent2Id},
      'R099999Z',
      'pending',
      'Unverified Realty Pte Ltd',
      'Agent profile intentionally not found in the CEA seed CSV for negative-path validation.',
      array['HDB rentals'],
      array['English'],
      null
    )
    on conflict (user_id) do update set
      cea_registration_no = excluded.cea_registration_no,
      cea_status = excluded.cea_status,
      agency_name = excluded.agency_name,
      verified_at = null,
      updated_at = now()
  `;
}

async function seedMrtAmenities(sql: postgres.Sql): Promise<void> {
  const csv = await readFile(join(dataDir, "mrt_stations.csv"), "utf8");
  for (const station of parseMrtStationsCsv(csv)) {
    await sql`
      insert into external.onemap_amenities (
        name, amenity_type, address, lines, geom, source, source_payload
      )
      values (
        ${station.name}, 'MRT', ${`${station.name} MRT Station`}, ${station.lines},
        ST_SetSRID(ST_MakePoint(${station.lng}, ${station.lat}), 4326),
        'seed',
        ${JSON.stringify({ seed: true, lines: station.lines })}
      )
      on conflict (name, amenity_type) do update set
        address = excluded.address,
        lines = excluded.lines,
        geom = excluded.geom,
        source_payload = excluded.source_payload,
        updated_at = now()
    `;
  }
}

async function seedListing(
  sql: postgres.Sql,
  s3: S3Client,
  bucket: string,
  userIds: Map<string, string>,
  listing: ListingSeed,
  index: number
): Promise<string> {
  const ownerId = userIds.get(listing.ownerEmail);
  const agentId = listing.agentEmail ? userIds.get(listing.agentEmail) : undefined;
  if (!ownerId) {
    throw new Error(`Owner fixture user missing for ${listing.ownerEmail}`);
  }

  const listingId = stableUuid(`listing:${listingIdentity(listing)}`);
  const addressId = stableUuid(`address:${listingIdentity(listing)}`);
  const blockId = stableUuid(`block:${listingIdentity(listing)}`);
  const unitId = stableUuid(`unit:${listingIdentity(listing)}`);
  const slug = `${slugify(listing.title)}-${listingId.slice(0, 8)}`;

  await sql`
    insert into addresses (
      id, line_1, block, street, postal_code, town, country_code,
      latitude, longitude, location
    )
    values (
      ${addressId}, ${`${listing.block} ${listing.street}`}, ${listing.block},
      ${listing.street}, ${listing.postal}, ${listing.town}, 'SG',
      ${String(listing.lat)}, ${String(listing.lng)},
      ST_SetSRID(ST_MakePoint(${listing.lng}, ${listing.lat}), 4326)::geography
    )
    on conflict (id) do update set
      line_1 = excluded.line_1,
      block = excluded.block,
      street = excluded.street,
      postal_code = excluded.postal_code,
      town = excluded.town,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      location = excluded.location,
      updated_at = now()
  `;

  await sql`
    insert into blocks (id, address_id, block_no, street_name, postal_code, town, total_floors, hdb_town_code)
    values (${blockId}, ${addressId}, ${listing.block}, ${listing.street}, ${listing.postal}, ${listing.town}, 16, ${listing.town.slice(0, 3)})
    on conflict (block_no, street_name, town) do update set
      address_id = excluded.address_id,
      postal_code = excluded.postal_code,
      updated_at = now()
  `;

  await sql`
    insert into units (
      id, block_id, address_id, unit_no, floor_no, stack_no, floor_level_band,
      bedrooms, bathrooms, floor_area_sqft
    )
    values (
      ${unitId}, ${blockId}, ${addressId}, ${`#${String(6 + index).padStart(2, "0")}-${String(10 + index).padStart(2, "0")}`},
      ${6 + index}, ${String(10 + index)}, ${listing.floorLevelBand},
      ${listing.bedrooms}, ${listing.bathrooms}, ${listing.floorAreaSqft}
    )
    on conflict (block_id, unit_no) do update set
      address_id = excluded.address_id,
      floor_no = excluded.floor_no,
      stack_no = excluded.stack_no,
      floor_level_band = excluded.floor_level_band,
      bedrooms = excluded.bedrooms,
      bathrooms = excluded.bathrooms,
      floor_area_sqft = excluded.floor_area_sqft,
      updated_at = now()
  `;

  await sql`
    insert into listings (
      id, owner_user_id, agent_user_id, address_id, status, listing_type,
      property_type, represented_via, title, slug, description, price_sgd,
      price_unit, bedrooms, bathrooms, published_at, expires_at, refreshed_at,
      search_vector
    )
    values (
      ${listingId}, ${ownerId}, ${agentId ?? null}, ${addressId}, 'published', 'rental',
      'hdb', ${agentId ? "agent_mandate" : "owner"}, ${listing.title}, ${slug},
      ${listing.description}, ${Number(listing.priceCents)}, 'month', ${listing.bedrooms},
      ${listing.bathrooms}, now(), now() + interval '30 days', now(),
      to_tsvector('english', ${`${listing.title} ${listing.description} ${listing.town} ${listing.flatType}`})
    )
    on conflict (id) do update set
      owner_user_id = excluded.owner_user_id,
      agent_user_id = excluded.agent_user_id,
      address_id = excluded.address_id,
      status = 'published',
      listing_type = excluded.listing_type,
      property_type = excluded.property_type,
      represented_via = excluded.represented_via,
      title = excluded.title,
      slug = excluded.slug,
      description = excluded.description,
      price_sgd = excluded.price_sgd,
      bedrooms = excluded.bedrooms,
      bathrooms = excluded.bathrooms,
      search_vector = excluded.search_vector,
      updated_at = now()
  `;

  await sql`
    insert into listing_rental (
      listing_id, lease_months, available_from, furnishing, room_only, deposit_sgd,
      utilities_included, pet_allowed, cooking_allowed, smoking_allowed, tenancy_terms
    )
    values (
      ${listingId}, ${listing.leaseMonths}, ${listing.availableFrom}, ${listing.furnishing},
      false, ${Number(listing.priceCents)}, false, ${index % 3 === 0}, true, false,
      ${JSON.stringify({ minimumLeaseMonths: listing.leaseMonths, wholeUnit: true })}
    )
    on conflict (listing_id) do update set
      lease_months = excluded.lease_months,
      available_from = excluded.available_from,
      furnishing = excluded.furnishing,
      deposit_sgd = excluded.deposit_sgd,
      tenancy_terms = excluded.tenancy_terms,
      updated_at = now()
  `;

  await sql`
    insert into listing_hdb (
      listing_id, flat_type, flat_model, floor_level_band, floor_area_sqft,
      block_id, unit_id, lease_commence_year
    )
    values (
      ${listingId}, ${listing.flatType}, 'Model A', ${listing.floorLevelBand},
      ${listing.floorAreaSqft}, ${blockId}, ${unitId}, 1998
    )
    on conflict (listing_id) do update set
      flat_type = excluded.flat_type,
      flat_model = excluded.flat_model,
      floor_level_band = excluded.floor_level_band,
      floor_area_sqft = excluded.floor_area_sqft,
      block_id = excluded.block_id,
      unit_id = excluded.unit_id,
      updated_at = now()
  `;

  await sql`
    insert into listing_events (id, listing_id, actor_user_id, event_type, metadata)
    values (
      ${stableUuid(`listing-event:${listingIdentity(listing)}:published`)},
      ${listingId},
      ${agentId ?? ownerId},
      'published',
      ${JSON.stringify({ seed: true })}
    )
    on conflict (id) do nothing
  `;

  await uploadListingPhotos(sql, s3, bucket, listing, listingId);
  return listingId;
}

async function uploadListingPhotos(
  sql: postgres.Sql,
  s3: S3Client,
  bucket: string,
  listing: ListingSeed,
  listingId: string
): Promise<void> {
  const photoFiles = ["living-room.jpg", "kitchen.jpg", "bedroom.jpg"];
  const roomTags = ["Living", "Kitchen", "Bedroom"] as const;
  for (const [sortOrder, fileName] of photoFiles.entries()) {
    const source = join(photosDir, fileName);
    const objectPath = `listings/${listingId}/${sortOrder + 1}-${fileName}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectPath,
        Body: createReadStream(source),
        ContentType: "image/jpeg"
      })
    );

    await sql`
      insert into listing_photos (
        id, listing_id, s3_key, alt_text, caption, sort_order, room_tag,
        width, height, is_cover
      )
      values (
        ${stableUuid(`listing-photo:${listingIdentity(listing)}:${sortOrder}`)},
        ${listingId},
        ${objectPath},
        ${`${listing.title} photo ${sortOrder + 1}`},
        ${`${listing.town} rental photo`},
        ${sortOrder},
        ${roomTags[sortOrder] ?? "Living"},
        1200,
        800,
        ${sortOrder === 0}
      )
      on conflict (listing_id, sort_order) do update set
        alt_text = excluded.alt_text,
        caption = excluded.caption,
        room_tag = excluded.room_tag,
        width = excluded.width,
        height = excluded.height,
        is_cover = excluded.is_cover,
        updated_at = now()
    `;
  }
}

async function seedSavedSearchAndFavorites(
  sql: postgres.Sql,
  userIds: Map<string, string>,
  listingIds: string[]
): Promise<void> {
  const renterId = userIds.get("renter1@proppy.test");
  if (!renterId) {
    throw new Error("renter1 fixture user was not created");
  }

  await sql`
    insert into saved_searches (id, user_id, name, query, notify_email, last_run_at)
    values (
      ${stableUuid("saved-search:renter1:tampines-4-room")},
      ${renterId},
      '4-room in Tampines',
      ${JSON.stringify({ town: "TAMPINES", flat_type: "4-room" })},
      true,
      now()
    )
    on conflict (id) do update set
      query = excluded.query,
      notify_email = excluded.notify_email,
      updated_at = now()
  `;

  for (const listingId of listingIds.slice(0, 2)) {
    await sql`
      insert into favorites (id, user_id, listing_id)
      values (${stableUuid(`favorite:renter1:${listingId}`)}, ${renterId}, ${listingId})
      on conflict (user_id, listing_id) do update set updated_at = now()
    `;
  }
}

async function main(): Promise<void> {
  const databaseUrl = env("DATABASE_URL", "");
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the seed script");
  }
  const bucket = env("S3_BUCKET", "proppy-photos");
  const s3 = new S3Client({
    endpoint: env("S3_ENDPOINT", "http://localhost:9000"),
    region: env("S3_REGION", "us-east-1"),
    credentials: {
      accessKeyId: env("S3_ACCESS_KEY_ID", "minioadmin"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY", "minioadmin")
    },
    forcePathStyle: true
  });

  await ensureBucket(s3, bucket);

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await seedCea(sql);
    const userIds = await upsertUsers(sql);
    await seedAgentProfiles(sql, userIds);
    await seedMrtAmenities(sql);

    const listingIds: string[] = [];
    for (const [index, listing] of listings.entries()) {
      listingIds.push(await seedListing(sql, s3, bucket, userIds, listing, index));
    }

    await seedSavedSearchAndFavorites(sql, userIds, listingIds);

    const [counts] = await sql<{
      users: string;
      listings: string;
      listing_photos: string;
      cea_rows: string;
      mrt_rows: string;
      saved_searches: string;
      favorites: string;
    }[]>`
      select
        (select count(*) from users) as users,
        (select count(*) from listings where status = 'published') as listings,
        (select count(*) from listing_photos) as listing_photos,
        (select count(*) from external.cea_register_snapshots) as cea_rows,
        (select count(*) from external.onemap_amenities where amenity_type = 'MRT') as mrt_rows,
        (select count(*) from saved_searches) as saved_searches,
        (select count(*) from favorites) as favorites
    `;
    console.log("Seed complete", counts);
  } finally {
    await sql.end();
  }
}

await main();
