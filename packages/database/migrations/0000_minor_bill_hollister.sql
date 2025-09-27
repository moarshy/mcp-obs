CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "oauth_access_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "oauth_access_token_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "oauth_application" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"icon" text,
	"metadata" text,
	"client_id" text,
	"client_secret" text,
	"redirect_u_r_ls" text,
	"type" text,
	"disabled" boolean,
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "oauth_application_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"consent_given" boolean
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mcp_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_end_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"password_hash" text,
	"google_id" text,
	"github_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_name" text NOT NULL,
	"client_uri" text,
	"logo_uri" text,
	"redirect_uris" text NOT NULL,
	"scope" text,
	"grant_types" text DEFAULT 'authorization_code,refresh_token' NOT NULL,
	"response_types" text DEFAULT 'code' NOT NULL,
	"token_endpoint_auth_method" text DEFAULT 'client_secret_basic' NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"client_id_issued_at" timestamp DEFAULT now() NOT NULL,
	"client_secret_expires_at" timestamp,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_oauth_client_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorization_code" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text,
	"state" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_oauth_code_authorization_code_unique" UNIQUE("authorization_code")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"granted" boolean NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" text DEFAULT 'Bearer' NOT NULL,
	"scope" text,
	"expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"code_challenge" text,
	"code_challenge_method" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "mcp_oauth_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "mcp_oauth_token_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "mcp_server_session" (
	"mcp_server_session_id" text PRIMARY KEY NOT NULL,
	"mcp_server_slug" text NOT NULL,
	"mcp_server_user_id" text NOT NULL,
	"session_data" jsonb,
	"connection_date" timestamp DEFAULT now(),
	"connection_timestamp" bigint,
	"expires_at" bigint,
	"revoked_at" bigint
);
--> statement-breakpoint
CREATE TABLE "mcp_server_user" (
	"id" text PRIMARY KEY NOT NULL,
	"tracking_id" text,
	"email" text,
	"upstream_sub" text,
	"profile_data" jsonb,
	"first_seen_at" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_server_user_tracking_id_unique" UNIQUE("tracking_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"active_organization_id" text,
	"mcp_server_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "mcp_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_user_id" text NOT NULL,
	"mcp_server_slug" text NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"execution_time_ms" integer,
	"success" boolean,
	"error_message" text,
	"created_at" bigint
);
--> statement-breakpoint
CREATE TABLE "mcp_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upstream_oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_user_id" text NOT NULL,
	"oauth_config_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" bigint,
	"created_at" bigint,
	"updated_at" bigint
);
--> statement-breakpoint
CREATE TABLE "mcp_server" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"organization_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"issuer_url" text NOT NULL,
	"authorization_endpoint" text NOT NULL,
	"token_endpoint" text NOT NULL,
	"registration_endpoint" text NOT NULL,
	"introspection_endpoint" text NOT NULL,
	"revocation_endpoint" text NOT NULL,
	"allow_registration" boolean DEFAULT true NOT NULL,
	"require_email_verification" boolean DEFAULT false NOT NULL,
	"enable_password_auth" boolean DEFAULT true NOT NULL,
	"enable_google_auth" boolean DEFAULT true NOT NULL,
	"enable_github_auth" boolean DEFAULT true NOT NULL,
	"access_token_expiration" integer DEFAULT 7200 NOT NULL,
	"refresh_token_expiration" integer DEFAULT 604800 NOT NULL,
	"scopes_supported" text DEFAULT 'read,write' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_server_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_account" ADD CONSTRAINT "mcp_account_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_client" ADD CONSTRAINT "mcp_oauth_client_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_client_id_mcp_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_consent" ADD CONSTRAINT "mcp_oauth_consent_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_consent" ADD CONSTRAINT "mcp_oauth_consent_client_id_mcp_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_consent" ADD CONSTRAINT "mcp_oauth_consent_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_token" ADD CONSTRAINT "mcp_oauth_token_client_id_mcp_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_token" ADD CONSTRAINT "mcp_oauth_token_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_token" ADD CONSTRAINT "mcp_oauth_token_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_session" ADD CONSTRAINT "mcp_server_session_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_session" ADD CONSTRAINT "mcp_session_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upstream_oauth_tokens" ADD CONSTRAINT "upstream_oauth_tokens_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;