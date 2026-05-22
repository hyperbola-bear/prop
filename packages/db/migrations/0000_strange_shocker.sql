CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE listing_status AS ENUM ('draft', 'pending_verification', 'active', 'published', 'paused', 'expired', 'rented', 'delisted', 'removed', 'flagged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE SCHEMA "external";
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_1" text NOT NULL,
	"line_2" text,
	"block" text,
	"street" text NOT NULL,
	"building" text,
	"unit_number" text,
	"postal_code" text,
	"town" text NOT NULL,
	"district" text,
	"country_code" text DEFAULT 'SG' NOT NULL,
	"latitude" text,
	"longitude" text,
	"location" geography(Point,4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amenity_type" text NOT NULL,
	"address_id" uuid,
	"location" geography(Point,4326),
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"address_id" uuid,
	"block_no" text NOT NULL,
	"street_name" text NOT NULL,
	"postal_code" text,
	"town" text NOT NULL,
	"total_floors" integer,
	"hdb_town_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"project_type" text NOT NULL,
	"tenure" text,
	"completion_year" integer,
	"developer_name" text,
	"address_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_project_type_check" CHECK ("projects"."project_type" in ('hdb', 'condo', 'landed', 'mixed'))
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid,
	"address_id" uuid,
	"unit_no" text,
	"floor_no" integer,
	"stack_no" text,
	"floor_level_band" text,
	"bedrooms" integer,
	"bathrooms" integer,
	"floor_area_sqft" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "units_floor_level_band_check" CHECK ("units"."floor_level_band" is null or "units"."floor_level_band" in ('low', 'mid', 'high'))
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cea_registration_no" text NOT NULL,
	"cea_status" text,
	"agency_name" text,
	"agency_licence_no" text,
	"photo_s3_key" text,
	"bio" text,
	"specialties" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"verified_at" timestamp with time zone,
	"lifetime_listings_count" integer DEFAULT 0 NOT NULL,
	"response_stats" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"agent_user_id" uuid NOT NULL,
	"mandate_via" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listing_mandates_status_check" CHECK ("listing_mandates"."status" in ('pending', 'active', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "seller_property_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"listing_id" uuid,
	"address_id" uuid,
	"document_s3_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "seller_property_verifications_status_check" CHECK ("seller_property_verifications"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "external"."cea_register_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"registration_no" text NOT NULL,
	"name" text NOT NULL,
	"agency_name" text NOT NULL,
	"agency_licence_no" text,
	"status" text NOT NULL,
	"first_registered_date" date,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external"."hdb_resale_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"month" date NOT NULL,
	"town" text NOT NULL,
	"flat_type" text NOT NULL,
	"block" text NOT NULL,
	"street_name" text NOT NULL,
	"storey_range" text,
	"floor_area_sqm" integer,
	"flat_model" text,
	"lease_commence_date" integer,
	"remaining_lease" text,
	"resale_price_sgd" bigint NOT NULL,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external"."onemap_amenities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"amenity_type" text NOT NULL,
	"address" text,
	"postal_code" text,
	"lines" text[] DEFAULT '{}'::text[] NOT NULL,
	"geom" geometry(Point,4326) NOT NULL,
	"source" text DEFAULT 'onemap' NOT NULL,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external"."ura_private_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_name" text NOT NULL,
	"street_name" text,
	"property_type" text,
	"sale_date" date NOT NULL,
	"transacted_price_sgd" bigint NOT NULL,
	"area_sqft" integer,
	"unit_price_psf_sgd" bigint,
	"tenure" text,
	"postal_district" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external"."ura_rental_medians" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"quarter" text NOT NULL,
	"district" text NOT NULL,
	"property_type" text NOT NULL,
	"bedrooms" integer,
	"median_rent_sgd" bigint NOT NULL,
	"sample_size" integer,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_user_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"body" text NOT NULL,
	"review_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "agent_reviews_stars_check" CHECK ("agent_reviews"."stars" between 1 and 5),
	CONSTRAINT "agent_reviews_review_type_check" CHECK ("agent_reviews"."review_type" in ('verified', 'unverified'))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"first_response_at" timestamp with time zone,
	"sla_breached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"scam_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"scam_score" smallint DEFAULT 0 NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "messages_scam_score_check" CHECK ("messages"."scam_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"body" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "reports_target_type_check" CHECK ("reports"."target_type" in ('listing', 'message', 'agent', 'user')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('open', 'reviewing', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_condo" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"unit_id" uuid,
	"unit_type" text,
	"floor_area_sqft" integer,
	"balcony_sqft" integer,
	"maintenance_fee_sgd" bigint,
	"facilities" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_hdb" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"flat_type" text NOT NULL,
	"flat_model" text,
	"floor_level_band" text,
	"floor_area_sqft" integer NOT NULL,
	"block_id" uuid,
	"unit_id" uuid,
	"lease_commence_year" integer,
	"ethnic_quota_eligible" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listing_hdb_flat_type_check" CHECK ("listing_hdb"."flat_type" in ('1-room', '2-room', '3-room', '4-room', '5-room', 'Executive')),
	CONSTRAINT "listing_hdb_floor_level_band_check" CHECK ("listing_hdb"."floor_level_band" is null or "listing_hdb"."floor_level_band" in ('low', 'mid', 'high'))
);
--> statement-breakpoint
CREATE TABLE "listing_landed" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"landed_type" text NOT NULL,
	"land_area_sqft" integer,
	"built_up_sqft" integer,
	"storeys" integer,
	"tenure" text,
	"parking_spaces" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_rental" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"lease_months" integer NOT NULL,
	"available_from" date NOT NULL,
	"furnishing" text NOT NULL,
	"room_only" boolean DEFAULT false NOT NULL,
	"deposit_sgd" bigint,
	"utilities_included" boolean DEFAULT false NOT NULL,
	"pet_allowed" boolean DEFAULT false NOT NULL,
	"cooking_allowed" boolean DEFAULT true NOT NULL,
	"smoking_allowed" boolean DEFAULT false NOT NULL,
	"gender_preference" text,
	"tenant_race_preference" text,
	"visa_preference" text,
	"tenancy_terms" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listing_rental_lease_months_check" CHECK ("listing_rental"."lease_months" between 1 and 36),
	CONSTRAINT "listing_rental_furnishing_check" CHECK ("listing_rental"."furnishing" in ('Unfurnished', 'Partial', 'Fully'))
);
--> statement-breakpoint
CREATE TABLE "listing_room" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"room_type" text NOT NULL,
	"room_tag" text,
	"ensuite_bathroom" boolean DEFAULT false NOT NULL,
	"max_occupants" integer DEFAULT 1 NOT NULL,
	"floor_area_sqft" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_sale" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"asking_price_sgd" bigint NOT NULL,
	"valuation_price_sgd" bigint,
	"option_fee_sgd" bigint,
	"completion_timeline" text,
	"sale_tenure_remaining_months" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"agent_user_id" uuid,
	"address_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"listing_type" text DEFAULT 'rental' NOT NULL,
	"property_type" text DEFAULT 'hdb' NOT NULL,
	"represented_via" text DEFAULT 'owner' NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"description" text,
	"price_sgd" bigint NOT NULL,
	"price_unit" text DEFAULT 'month' NOT NULL,
	"bedrooms" integer,
	"bathrooms" integer,
	"seller_ownership_verified" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector",
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"refreshed_at" timestamp with time zone,
	"rented_at" timestamp with time zone,
	"delisted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listings_status_check" CHECK ("listings"."status" in ('draft', 'pending_verification', 'active', 'published', 'paused', 'expired', 'rented', 'delisted', 'removed', 'flagged')),
	CONSTRAINT "listings_listing_type_check" CHECK ("listings"."listing_type" in ('rental', 'room', 'sale')),
	CONSTRAINT "listings_property_type_check" CHECK ("listings"."property_type" in ('hdb', 'condo', 'landed')),
	CONSTRAINT "listings_represented_via_check" CHECK ("listings"."represented_via" in ('owner', 'agent_mandate', 'agent_no_mandate'))
);
--> statement-breakpoint
CREATE TABLE "listing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_floor_plan_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_plan_id" uuid NOT NULL,
	"room_tag" text NOT NULL,
	"polygon_geojson" jsonb,
	"bbox" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listing_floor_plan_zones_room_tag_check" CHECK ("listing_floor_plan_zones"."room_tag" in ('Living', 'Kitchen', 'Bedroom', 'Bathroom', 'Balcony', 'Utility', 'Store'))
);
--> statement-breakpoint
CREATE TABLE "listing_floor_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_photo_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"s3_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"thumbnail_s3_key" text,
	"alt_text" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"room_tag" text,
	"width" integer,
	"height" integer,
	"blurhash" text,
	"perceptual_hash" text,
	"exif" jsonb,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listing_photos_room_tag_check" CHECK ("listing_photos"."room_tag" is null or "listing_photos"."room_tag" in ('Living', 'Kitchen', 'Bedroom', 'Bathroom', 'Balcony', 'Exterior', 'Floor plan'))
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"listing_id" uuid,
	"scope" text NOT NULL,
	"content_type" text NOT NULL,
	"s3_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "buyer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_name" text,
	"household_size" text,
	"employer_name" text,
	"preferred_contact_method" text DEFAULT 'email' NOT NULL,
	"move_in_window_start" date,
	"move_in_window_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_key" text NOT NULL,
	"action" text NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"is_company" boolean DEFAULT false NOT NULL,
	"uen" text,
	"preferred_contact_method" text DEFAULT 'email' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_roles_role_check" CHECK ("user_roles"."role" in ('admin', 'buyer', 'seller', 'agent'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"password_hash" text,
	"phone_verified_at" timestamp with time zone,
	"pdpa_consent_at" timestamp with time zone,
	"myinfo_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_mandates" ADD CONSTRAINT "listing_mandates_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_mandates" ADD CONSTRAINT "listing_mandates_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_mandates" ADD CONSTRAINT "listing_mandates_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_property_verifications" ADD CONSTRAINT "seller_property_verifications_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_property_verifications" ADD CONSTRAINT "seller_property_verifications_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_property_verifications" ADD CONSTRAINT "seller_property_verifications_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_property_verifications" ADD CONSTRAINT "seller_property_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_condo" ADD CONSTRAINT "listing_condo_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_condo" ADD CONSTRAINT "listing_condo_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_condo" ADD CONSTRAINT "listing_condo_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_hdb" ADD CONSTRAINT "listing_hdb_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_hdb" ADD CONSTRAINT "listing_hdb_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_hdb" ADD CONSTRAINT "listing_hdb_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_landed" ADD CONSTRAINT "listing_landed_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_rental" ADD CONSTRAINT "listing_rental_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_room" ADD CONSTRAINT "listing_room_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_sale" ADD CONSTRAINT "listing_sale_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_floor_plan_zones" ADD CONSTRAINT "listing_floor_plan_zones_floor_plan_id_listing_floor_plans_id_fk" FOREIGN KEY ("floor_plan_id") REFERENCES "public"."listing_floor_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_floor_plans" ADD CONSTRAINT "listing_floor_plans_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photo_variants" ADD CONSTRAINT "listing_photo_variants_photo_id_listing_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."listing_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_town_idx" ON "addresses" USING btree ("town");--> statement-breakpoint
CREATE INDEX "addresses_location_idx" ON "addresses" USING gist ("location");--> statement-breakpoint
CREATE INDEX "amenities_type_idx" ON "amenities" USING btree ("amenity_type");--> statement-breakpoint
CREATE INDEX "amenities_location_idx" ON "amenities" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_block_street_town_unique" ON "blocks" USING btree ("block_no","street_name","town");--> statement-breakpoint
CREATE INDEX "blocks_town_idx" ON "blocks" USING btree ("town");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_unique" ON "projects" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "units_block_unit_unique" ON "units" USING btree ("block_id","unit_no");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_profiles_user_unique" ON "agent_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_profiles_cea_registration_unique" ON "agent_profiles" USING btree ("cea_registration_no");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_mandates_listing_agent_unique" ON "listing_mandates" USING btree ("listing_id","agent_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cea_register_snapshots_registration_snapshot_unique" ON "external"."cea_register_snapshots" USING btree ("registration_no","snapshot_at");--> statement-breakpoint
CREATE INDEX "cea_register_snapshots_registration_idx" ON "external"."cea_register_snapshots" USING btree ("registration_no");--> statement-breakpoint
CREATE INDEX "hdb_resale_transactions_town_flat_idx" ON "external"."hdb_resale_transactions" USING btree ("town","flat_type");--> statement-breakpoint
CREATE INDEX "hdb_resale_transactions_month_idx" ON "external"."hdb_resale_transactions" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "onemap_amenities_name_type_unique" ON "external"."onemap_amenities" USING btree ("name","amenity_type");--> statement-breakpoint
CREATE INDEX "onemap_amenities_type_idx" ON "external"."onemap_amenities" USING btree ("amenity_type");--> statement-breakpoint
CREATE INDEX "onemap_amenities_geom_idx" ON "external"."onemap_amenities" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "ura_private_transactions_project_date_idx" ON "external"."ura_private_transactions" USING btree ("project_name","sale_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ura_rental_medians_unique" ON "external"."ura_rental_medians" USING btree ("quarter","district","property_type","bedrooms");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_reviews_agent_reviewer_unique" ON "agent_reviews" USING btree ("agent_user_id","reviewer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_listing_buyer_seller_unique" ON "conversations" USING btree ("listing_id","buyer_user_id","seller_user_id");--> statement-breakpoint
CREATE INDEX "enquiries_listing_buyer_idx" ON "enquiries" USING btree ("listing_id","buyer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_listing_unique" ON "favorites" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_owner_user_idx" ON "listings" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "listings_agent_user_idx" ON "listings" USING btree ("agent_user_id");--> statement-breakpoint
CREATE INDEX "listings_published_at_idx" ON "listings" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "listings_search_idx" ON "listings" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_photos_listing_sort_unique" ON "listing_photos" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE INDEX "request_logs_bucket_action_created_idx" ON "request_logs" USING btree ("bucket_key","action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_unique" ON "user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_e164_unique" ON "users" USING btree ("phone_e164");