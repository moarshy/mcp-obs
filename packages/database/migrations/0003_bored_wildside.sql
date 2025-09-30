CREATE TABLE "mcp_server_api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"name" text DEFAULT 'Telemetry API Key',
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "telemetry_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"metric_name" text NOT NULL,
	"metric_type" text NOT NULL,
	"value" double precision NOT NULL,
	"labels" jsonb,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_trace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"trace_id" text NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"operation_name" text NOT NULL,
	"start_time" bigint NOT NULL,
	"end_time" bigint NOT NULL,
	"duration_ns" bigint NOT NULL,
	"mcp_operation_type" text,
	"mcp_tool_name" text,
	"mcp_user_id" text,
	"mcp_session_id" text,
	"span_status" text DEFAULT 'OK',
	"error_message" text,
	"span_data" jsonb NOT NULL,
	"exported_to_customer" boolean DEFAULT false,
	"export_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "telemetry_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server_api_key" ADD CONSTRAINT "mcp_server_api_key_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_metric" ADD CONSTRAINT "telemetry_metric_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_trace" ADD CONSTRAINT "telemetry_trace_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;