ALTER TABLE "mcp_server" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "allow_registration" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "require_email_verification" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "enable_password_auth" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "enable_google_auth" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "enable_github_auth" boolean DEFAULT true NOT NULL;