import "./load-env.js";
import { seed } from "../indexer/src/seed-lib.js";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set in environment.");
  process.exit(1);
}

seed(dbUrl)
  .then(() => {
    console.log("Database seeded successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Database seeding failed:", err);
    process.exit(1);
  });
