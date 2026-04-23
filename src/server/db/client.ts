import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import { initializeDatabase } from "./init";

const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), "data", "app.db");
const sqlite = new Database(dbPath);

initializeDatabase(sqlite);

export const db = drizzle(sqlite);
export { sqlite };
