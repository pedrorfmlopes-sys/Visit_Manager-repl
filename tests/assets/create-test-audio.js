/**
 * Criar ficheiro WebM minimalista para teste
 * WebM é o formato que MediaRecorder usa por default no browser
 */

const fs = require('fs');
const path = require('path');

// WebM header válido mas vazio (EBML + Segment)
// Suficiente para testar se Whisper API aceita o formato
const webmHeader = Buffer.from([
  // EBML Element (26 bytes)
  0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x1F, 0x42, 0x86, 0x81, 0x01,
  0x42, 0xF7, 0x81, 0x01, 0x42, 0xF2, 0x81, 0x04,
  0x42, 0xF3, 0x81, 0x08
]);

const outputPath = path.join(__dirname, 'test-audio.webm');
fs.writeFileSync(outputPath, webmHeader);

console.log(`✓ Created: ${outputPath}`);
console.log(`  Size: ${webmHeader.length} bytes`);
console.log(`  Type: audio/webm`);
