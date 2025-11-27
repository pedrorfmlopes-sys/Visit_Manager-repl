import { db } from "../db";
import { leads } from "../../shared/schema";

async function main() {
  const allLeads = await db.select().from(leads);
  console.log("TOTAL LEADS:", allLeads.length);
  console.dir(allLeads, { depth: 3 });
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
