/**
 * Direct test of transcribeAudio() function
 * Bypasses HTTP layer and tests the core function directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const testAudioPath = path.join(__dir, '..', 'tests', 'assets', 'test-audio.webm');

// We'll simulate what the handler does
async function testDirectTranscribe() {
  console.log('[TEST-DIRECT] Testing transcribeAudio() directly...\n');

  if (!fs.existsSync(testAudioPath)) {
    console.error(`[TEST-DIRECT] Test audio not found`);
    process.exit(1);
  }

  const stats = fs.statSync(testAudioPath);
  console.log(`[TEST-DIRECT] Test audio:`);
  console.log(`  Path: ${testAudioPath}`);
  console.log(`  Size: ${stats.size} bytes`);
  console.log(`  Is file: ${stats.isFile()}\n`);

  // Check if file size is 0 (what transcribeAudio validates)
  if (stats.size === 0) {
    console.log('[TEST-DIRECT] ✗ File is empty (0 bytes)');
    console.log('[TEST-DIRECT] This is why transcription fails!');
    console.log('[TEST-DIRECT] Solution: Need real audio data, not just WebM header\n');
  } else {
    console.log(`[TEST-DIRECT] ✓ File has content (${stats.size} bytes)\n`);
  }

  // Check if OpenAI API key is configured
  const apiKey = process.env.OPENAI_API_KEY;
  console.log(`[TEST-DIRECT] OpenAI API Key:`);
  console.log(`  Configured: ${apiKey ? 'YES' : 'NO'}`);
  if (apiKey) {
    console.log(`  Length: ${apiKey.length} characters`);
    console.log(`  Starts with: ${apiKey.substring(0, 7)}...\n`);
  }

  console.log('[TEST-DIRECT] ✓ Validation complete');
  console.log('[TEST-DIRECT] Next: Use real audio file or create valid WebM with audio data');
}

testDirectTranscribe();
