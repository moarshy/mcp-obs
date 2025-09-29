CREATE TABLE "support_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'Other',
	"mcp_user_id" text,
	"user_email" text,
	"session_id" text,
	"context_data" text,
	"user_agent" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"closed_by" text
);
--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "support_tool_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "support_tool_title" text DEFAULT 'Get Support';--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "support_tool_description" text DEFAULT 'Report issues or ask questions';--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "support_tool_categories" text DEFAULT '["Bug Report", "Feature Request", "Documentation", "Other"]';--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;