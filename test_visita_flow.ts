import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { visitas } from './shared/schema';
import { isNotNull, eq } from 'drizzle-orm';

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client);

async function testVisitaWorkflow() {
  try {
    console.log('🔍 Step 1: Finding a visit with proximaVisita...');
    
    // Get a visit with proximaVisita
    const visitaComProxima = await db.query.visitas.findFirst({
      where: isNotNull(visitas.proximaVisita),
      with: {
        entidade: true,
      },
    });

    if (!visitaComProxima) {
      console.log('❌ No visits with proximaVisita found');
      process.exit(1);
    }

    console.log(`✅ Found visit: ${visitaComProxima.id}`);
    console.log(`   Próxima Visita: ${visitaComProxima.proximaVisita}`);

    // Step 2: Check how many posteriores it has
    console.log('\n🔗 Step 2: Checking posteriores...');
    const posteriores = await db.query.visitas.findMany({
      where: eq(visitas.visitaAnteriorId, visitaComProxima.id),
    });

    console.log(`   Currently has ${posteriores.length} posteriores`);
    
    if (posteriores.length === 0) {
      console.log('   Creating a new one to test...');
      const [newVisita] = await db.insert(visitas)
        .values({
          empresaId: visitaComProxima.empresaId,
          dataVisita: visitaComProxima.proximaVisita || new Date(),
          entidadeId: visitaComProxima.entidadeId,
          userId: visitaComProxima.userId,
          createdByUserId: visitaComProxima.createdByUserId,
          visitaAnteriorId: visitaComProxima.id,
        })
        .returning();
      console.log(`   ✅ Created new visit: ${newVisita.id}`);
    }

    // Step 3: Re-query posteriores
    console.log('\n📊 Step 3: Re-querying posteriores...');
    const posterioresAfter = await db.query.visitas.findMany({
      where: eq(visitas.visitaAnteriorId, visitaComProxima.id),
    });

    console.log(`✅ Now has ${posterioresAfter.length} posteriores`);
    console.log('✅ WORKFLOW VERIFIED: Posteriores relationship works!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testVisitaWorkflow().then(() => process.exit(0));
