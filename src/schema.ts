import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const scores = sqliteTable("scores", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  teamId: text("team_id").notNull(),
  score: integer("score").notNull(),
  registeredAt: integer("registered_at").notNull(),
});
