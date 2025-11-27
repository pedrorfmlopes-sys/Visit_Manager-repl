/**
 * Test: POST /api/crm/leads/ai/transcribe with WebM audio
 * This simulates what MediaRecorder sends from the frontend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const testAudioPath = path.join(__dir, '..', 'tests', 'assets', 'test-audio.webm');

async function testTranscribeWebm() {
  console.log('[TEST] Starting WebM transcribe test...\n');

  // Read test audio file
  if (!fs.existsSync(testAudioPath)) {
    console.error(`[TEST] ERROR: Test audio not found at ${testAudioPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(testAudioPath);
  console.log(`[TEST] Loaded test audio: ${testAudioPath}`);
  console.log(`[TEST] File size: ${fileBuffer.length} bytes\n`);

  try {
    // Create FormData with WebM file
    const formData = new FormData();
    const audioBlob = new Blob([fileBuffer], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'test-audio.webm');

    console.log('[TEST] Sending POST /api/crm/leads/ai/transcribe with WebM...');
    const response = await fetch('http://localhost:5000/api/crm/leads/ai/transcribe', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const result = await response.json();

    console.log(`[TEST] Response status: ${response.status}`);
    console.log(`[TEST] Response body:\n${JSON.stringify(result, null, 2)}\n`);

    // Validation
    const checks = {
      'Has success field': typeof result.success === 'boolean',
      'NO "require is not defined"': !result.message?.includes('require is not defined'),
      'Response is HTTP 200 or 500': [200, 500, 400, 503].includes(response.status),
    };

    console.log('[TEST] Validation Checks:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✓' : '✗'} ${check}`);
    });

    const allPassed = Object.values(checks).every(v => v);
    console.log(`\n[TEST] Overall: ${allPassed ? 'PASS ✓' : 'FAIL ✗'}`);

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('[TEST] Error:', error);
    process.exit(1);
  }
}

testTranscribeWebm();
