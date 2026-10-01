CREATE INDEX IF NOT EXISTS "visitas_empresa_data_idx" ON "visitas" USING btree ("empresa_id", "data_visita");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tarefas_empresa_due_idx" ON "tarefas" USING btree ("empresa_id", "due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tarefas_empresa_unplanned_idx" ON "tarefas" USING btree ("empresa_id", "created_at") WHERE "due_date" IS NULL AND "status" = 'pending';
