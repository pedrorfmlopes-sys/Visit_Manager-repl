/**
 * Script de teste para createLeadAttachment
 * 
 * Uso:
 * npx tsx scripts/testCreateLeadAttachment.ts
 * 
 * Variáveis de ambiente esperadas:
 * - TEST_EMPRESA_ID: UUID da empresa na nossa BD
 * - TEST_ODOO_LEAD_ID: ID numérico do lead no Odoo
 */

import { createLeadAttachment } from "../server/integrations/odooClient";

async function testCreateLeadAttachment() {
  // Obter parâmetros do ambiente
  const empresaId = process.env.TEST_EMPRESA_ID || "test-empresa-uuid";
  const odooLeadId = process.env.TEST_ODOO_LEAD_ID || "123";
  
  // Buffer fake com conteúdo simples (arquivo de teste)
  const testContent = "Este é um arquivo de teste para anexo de lead no Odoo";
  const buffer = Buffer.from(testContent, "utf-8");
  
  console.log("[Test] Iniciando teste de createLeadAttachment");
  console.log("[Test] Parâmetros:");
  console.log(`  - empresaId: ${empresaId}`);
  console.log(`  - odooLeadId: ${odooLeadId}`);
  console.log(`  - fileName: test-document.txt`);
  console.log(`  - mimetype: text/plain`);
  console.log(`  - buffer size: ${buffer.length} bytes`);
  console.log("");
  
  try {
    console.log("[Test] Chamando createLeadAttachment...");
    const attachmentId = await createLeadAttachment({
      empresaId,
      odooLeadId: parseInt(odooLeadId, 10),
      fileName: "test-document.txt",
      mimetype: "text/plain",
      buffer,
    });
    
    console.log("[Test] ✅ SUCESSO!");
    console.log(`[Test] Anexo criado com ID: ${attachmentId}`);
    console.log("");
    console.log("Detalhes do resultado:");
    console.log(`  - Type: ${typeof attachmentId}`);
    console.log(`  - Value: ${attachmentId}`);
    
    process.exit(0);
  } catch (error: any) {
    console.error("[Test] ❌ ERRO!");
    console.error("[Test] Mensagem:", error?.message);
    console.error("[Test] Stack:", error?.stack);
    console.error("");
    console.error("Sugestões de troubleshooting:");
    console.error("  1. Verificar se TEST_EMPRESA_ID está correto");
    console.error("  2. Verificar se TEST_ODOO_LEAD_ID existe no Odoo");
    console.error("  3. Verificar se a empresa tem Odoo CRM ativado");
    console.error("  4. Verificar conectividade e credenciais Odoo");
    
    process.exit(1);
  }
}

testCreateLeadAttachment();
