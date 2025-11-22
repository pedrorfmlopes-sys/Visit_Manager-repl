/**
 * FASE 1 Migration Script: Multi-empresa architecture
 * 
 * This script:
 * 1. Creates an initial "Divitek" company (tenant)
 * 2. Associates all existing users with this company
 * 3. Associates all existing business data (entidades, contactos, visitas, tarefas, lembretes) with this company
 * 
 * Run with: npx tsx server/seed-enterprise.ts
 */

import { db } from "./db";
import { empresas, users, entidades, contactos, visitas, tarefas, lembretes, marcas } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";

async function seedEnterprise() {
  console.log("🌱 Starting FASE 1 Multi-empresa migration...\n");

  try {
    // 1. Check if Divitek company already exists
    const existingDivitek = await db
      .select()
      .from(empresas)
      .where(eq(empresas.nome, "Divitek"))
      .limit(1);

    let empresaId: string;

    if (existingDivitek.length > 0) {
      console.log("✅ Divitek company already exists");
      empresaId = existingDivitek[0].id;
    } else {
      // 2. Create Divitek company
      console.log("📝 Creating Divitek company...");
      const [newEmpresa] = await db
        .insert(empresas)
        .values({
          nome: "Divitek",
          nif: null,
          email: null,
          telefone: null,
          logoUrl: null,
          mostrarMarcasEmVisitas: false,
        })
        .returning();
      
      empresaId = newEmpresa.id;
      console.log(`✅ Divitek company created (ID: ${empresaId})\n`);
    }

    // 3. Associate all users without empresaId to Divitek
    console.log("👥 Associating users to Divitek...");
    const usersWithoutEmpresa = await db
      .select()
      .from(users)
      .where(isNull(users.empresaId));

    if (usersWithoutEmpresa.length > 0) {
      await db
        .update(users)
        .set({ empresaId })
        .where(isNull(users.empresaId));
      
      console.log(`✅ Associated ${usersWithoutEmpresa.length} users to Divitek\n`);
    } else {
      console.log("✅ All users already associated\n");
    }

    // 4. Associate all entidades without empresaId to Divitek
    console.log("🏢 Associating entidades to Divitek...");
    const entidadesWithoutEmpresa = await db
      .select()
      .from(entidades)
      .where(isNull(entidades.empresaId));

    if (entidadesWithoutEmpresa.length > 0) {
      await db
        .update(entidades)
        .set({ empresaId })
        .where(isNull(entidades.empresaId));
      
      console.log(`✅ Associated ${entidadesWithoutEmpresa.length} entidades to Divitek\n`);
    } else {
      console.log("✅ All entidades already associated\n");
    }

    // 5. Associate all contactos without empresaId to Divitek
    console.log("📞 Associating contactos to Divitek...");
    const contactosWithoutEmpresa = await db
      .select()
      .from(contactos)
      .where(isNull(contactos.empresaId));

    if (contactosWithoutEmpresa.length > 0) {
      await db
        .update(contactos)
        .set({ empresaId })
        .where(isNull(contactos.empresaId));
      
      console.log(`✅ Associated ${contactosWithoutEmpresa.length} contactos to Divitek\n`);
    } else {
      console.log("✅ All contactos already associated\n");
    }

    // 6. Associate all visitas without empresaId to Divitek
    console.log("📍 Associating visitas to Divitek...");
    const visitasWithoutEmpresa = await db
      .select()
      .from(visitas)
      .where(isNull(visitas.empresaId));

    if (visitasWithoutEmpresa.length > 0) {
      await db
        .update(visitas)
        .set({ empresaId })
        .where(isNull(visitas.empresaId));
      
      console.log(`✅ Associated ${visitasWithoutEmpresa.length} visitas to Divitek\n`);
    } else {
      console.log("✅ All visitas already associated\n");
    }

    // 7. Associate all tarefas without empresaId to Divitek
    console.log("✔️ Associating tarefas to Divitek...");
    const tarefasWithoutEmpresa = await db
      .select()
      .from(tarefas)
      .where(isNull(tarefas.empresaId));

    if (tarefasWithoutEmpresa.length > 0) {
      await db
        .update(tarefas)
        .set({ empresaId })
        .where(isNull(tarefas.empresaId));
      
      console.log(`✅ Associated ${tarefasWithoutEmpresa.length} tarefas to Divitek\n`);
    } else {
      console.log("✅ All tarefas already associated\n");
    }

    // 8. Associate all lembretes without empresaId to Divitek
    console.log("🔔 Associating lembretes to Divitek...");
    const lembretesWithoutEmpresa = await db
      .select()
      .from(lembretes)
      .where(isNull(lembretes.empresaId));

    if (lembretesWithoutEmpresa.length > 0) {
      await db
        .update(lembretes)
        .set({ empresaId })
        .where(isNull(lembretes.empresaId));
      
      console.log(`✅ Associated ${lembretesWithoutEmpresa.length} lembretes to Divitek\n`);
    } else {
      console.log("✅ All lembretes already associated\n");
    }

    // 9. Associate all marcas without empresaId to Divitek
    console.log("🏷️ Associating marcas to Divitek...");
    const marcasWithoutEmpresa = await db
      .select()
      .from(marcas)
      .where(isNull(marcas.empresaId));

    if (marcasWithoutEmpresa.length > 0) {
      await db
        .update(marcas)
        .set({ empresaId })
        .where(isNull(marcas.empresaId));
      
      console.log(`✅ Associated ${marcasWithoutEmpresa.length} marcas to Divitek\n`);
    } else {
      console.log("✅ All marcas already associated\n");
    }

    console.log("✨ FASE 1 migration completed successfully!");
    console.log(`\n📊 Summary:`);
    console.log(`   - Empresa ID: ${empresaId}`);
    console.log(`   - Company: Divitek`);
    console.log(`   - All business data is now associated with Divitek\n`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the seed
seedEnterprise()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
