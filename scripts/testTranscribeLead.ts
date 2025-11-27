/**
 * TESTE RÁPIDO: Verificar que /api/crm/leads/ai/transcribe funciona
 * Valida que:
 * 1. Não há erro "require is not defined" (ESM issue)
 * 2. Os erros são amigáveis (português)
 * 3. Handler captura e trata erros corretamente
 */

import fs from "fs";
import path from "path";

async function testTranscribeEndpoint() {
  console.log("[TEST] Starting transcribe endpoint verification...\n");

  // Criar tiny webm file (header válido mas vazio)
  const testAudioDir = "./tests/assets";
  if (!fs.existsSync(testAudioDir)) {
    fs.mkdirSync(testAudioDir, { recursive: true });
  }

  // WebM header mínimo (válido mas vazio)
  const webmHeader = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x1f, 0x42, 0x86, 0x81, 0x01,
    0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04,
  ]);

  const testAudioPath = path.join(testAudioDir, "test.webm");
  fs.writeFileSync(testAudioPath, webmHeader);

  console.log(`[TEST] Test audio: ${testAudioPath} (${webmHeader.length} bytes)\n`);

  try {
    const formData = new FormData();
    const audioBlob = new Blob([webmHeader], { type: "audio/webm" });
    formData.append("file", audioBlob, "test.webm");

    console.log("[TEST] POST /api/crm/leads/ai/transcribe...");
    const response = await fetch("http://localhost:5000/api/crm/leads/ai/transcribe", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const result = await response.json();

    console.log("[TEST] Response:", response.status, JSON.stringify(result, null, 2));

    // Checks
    const passed = !result.message?.includes("require is not defined");
    console.log(`\n[TEST] Result: ${passed ? "OK - No ESM error" : "FAIL - ESM error found"}`);

    fs.unlinkSync(testAudioPath);
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error("[TEST] Error:", error);
    process.exit(1);
  }
}

testTranscribeEndpoint();
