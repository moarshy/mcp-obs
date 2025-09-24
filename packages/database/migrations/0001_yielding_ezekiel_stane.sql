CREATE TABLE "mcp_end_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"email" text NOT NULL,
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
CREATE TABLE "mcp_server" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_url" text,
	"organization_id" text NOT NULL,
	"issuer_url" text NOT NULL,
	"authorization_endpoint" text NOT NULL,
	"token_endpoint" text NOT NULL,
	"registration_endpoint" text NOT NULL,
	"introspection_endpoint" text,
	"revocation_endpoint" text,
	"scopes_supported" text DEFAULT 'read,write' NOT NULL,
	"grant_types_supported" text DEFAULT 'authorization_code,refresh_token' NOT NULL,
	"response_types_supported" text DEFAULT 'code' NOT NULL,
	"code_challenge_methods_supported" text DEFAULT 'S256' NOT NULL,
	"access_token_expiration" integer DEFAULT 7200 NOT NULL,
	"refresh_token_expiration" integer DEFAULT 604800 NOT NULL,
	"require_pkce" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_server_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "mcp_end_user" ADD CONSTRAINT "mcp_end_user_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_client" ADD CONSTRAINT "mcp_oauth_client_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_client_id_mcp_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_code" ADD CONSTRAINT "mcp_oauth_code_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_consent" ADD CONSTRAINT "mcp_oauth_consent_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_consent" ADD CONSTRAINT "mcp_oauth_consent_client_id_mcp_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_consent" ADD CONSTRAINT "mcp_oauth_consent_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_token" ADD CONSTRAINT "mcp_oauth_token_client_id_mcp_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_token" ADD CONSTRAINT "mcp_oauth_token_user_id_mcp_end_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_end_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_token" ADD CONSTRAINT "mcp_oauth_token_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;