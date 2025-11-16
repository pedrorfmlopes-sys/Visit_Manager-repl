import { db } from "./db";
import { gabinetes, entidades, contactos, visitas } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Migration script to convert Gabinetes to Entidades
 * Run this once to migrate existing data
 */
async function migrateGabinetesToEntidades() {
  console.log("🚀 Starting migration from Gabinetes to Entidades...");

  try {
    // Step 1: Copy all gabinetes to entidades
    const existingGabinetes = await db.select().from(gabinetes);
    console.log(`📋 Found ${existingGabinetes.length} gabinetes to migrate`);

    let migrated = 0;
    for (const gabinete of existingGabinetes) {
      // Check if already migrated
      const existing = await db
        .select()
        .from(entidades)
        .where(eq(entidades.id, gabinete.id));

      if (existing.length > 0) {
        console.log(`⏭️  Skipping ${gabinete.nome} - already migrated`);
        continue;
      }

      // Insert into entidades with same ID
      await db.insert(entidades).values({
        id: gabinete.id, // Keep same ID for FK integrity
        tipoEntidade: 'Gabinete',
        nome: gabinete.nome,
        morada: gabinete.morada || undefined,
        cidade: gabinete.cidade || undefined,
        codigoPostal: gabinete.codigoPostal || undefined,
        email: gabinete.email || undefined,
        telefone: gabinete.telefone || undefined,
        website: gabinete.website || undefined,
        notas: gabinete.observacoes || undefined,
        latitude: undefined,
        longitude: undefined,
        nif: undefined,
        createdAt: gabinete.createdAt || new Date(),
        updatedAt: new Date(),
      });

      migrated++;
      console.log(`✅ Migrated: ${gabinete.nome}`);
    }

    console.log(`\n✨ Migration complete! Migrated ${migrated} gabinetes`);

    // Step 2: Update contactos to use entidade_id
    console.log("\n📝 Updating contactos...");
    const allContactos = await db.select().from(contactos);
    let updatedContactos = 0;

    for (const contacto of allContactos) {
      if (contacto.gabineteId && !contacto.entidadeId) {
        await db
          .update(contactos)
          .set({ entidadeId: contacto.gabineteId })
          .where(eq(contactos.id, contacto.id));
        updatedContactos++;
      }
    }
    console.log(`✅ Updated ${updatedContactos} contactos`);

    // Step 3: Update visitas to use entidade_id
    console.log("\n📝 Updating visitas...");
    const allVisitas = await db.select().from(visitas);
    let updatedVisitas = 0;

    for (const visita of allVisitas) {
      if (visita.gabineteId && !visita.entidadeId) {
        await db
          .update(visitas)
          .set({ entidadeId: visita.gabineteId })
          .where(eq(visitas.id, visita.id));
        updatedVisitas++;
      }
    }
    console.log(`✅ Updated ${updatedVisitas} visitas`);

    console.log("\n🎉 All migration steps complete!");
    console.log("\n⚠️  Next steps:");
    console.log("1. Verify data in entidades table");
    console.log("2. Update frontend to use /api/entidades");
    console.log("3. After verification, gabinetes table can be dropped");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateGabinetesToEntidades()
  .then(() => {
    console.log("\n✅ Migration script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });
