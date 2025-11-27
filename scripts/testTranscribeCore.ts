/**
 * Test script for /api/crm/leads/ai/transcribe endpoint
 * Creates a simple audio blob and sends it for transcription
 */
import fs from "fs";
import path from "path";

async function testTranscribeEndpoint() {
  console.log("\n=== Testing /api/crm/leads/ai/transcribe ===\n");

  try {
    // Create a tiny valid WAV file (silence, 100ms at 16kHz mono)
    // WAV header + minimal audio data
    const sampleRate = 16000;
    const channels = 1;
    const bitDepth = 16;
    const duration = 0.1; // 100ms
    const numSamples = Math.floor(sampleRate * duration);
    const byteRate = sampleRate * channels * bitDepth / 8;
    const blockAlign = channels * bitDepth / 8;
    const dataSize = numSamples * blockAlign;
    const fileSize = 36 + dataSize;

    // Create WAV buffer
    const buffer = Buffer.alloc(44 + dataSize);
    
    // WAV header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(fileSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // subchunk1size
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);
    
    // Audio data (silence = zeros)
    for (let i = 44; i < 44 + dataSize; i += 2) {
      buffer.writeInt16LE(0, i);
    }

    // Send to endpoint (localhost:5000)
    const formData = new FormData();
    const audioBlob = new Blob([buffer], { type: "audio/wav" });
    formData.append("file", audioBlob, "test-audio.wav");

    console.log("Sending test audio file...");
    console.log(`  File size: ${buffer.length} bytes`);
    console.log(`  Content-Type: audio/wav`);
    console.log("  Endpoint: POST /api/crm/leads/ai/transcribe\n");

    const response = await fetch("http://localhost:5000/api/crm/leads/ai/transcribe", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log("Response Body:");
    console.log(JSON.stringify(data, null, 2));

    // Analyze result
    console.log("\n=== Analysis ===");
    if (response.ok) {
      console.log("✅ Success (200-299)");
      if (data.success) {
        console.log(`✅ success: true, text length: ${data.text?.length || 0}`);
      } else {
        console.log(`⚠️  success: false, message: ${data.message}`);
      }
    } else if (response.status === 503) {
      console.log("⚠️  Status 503 - Service Unavailable (IA not configured or error)");
      console.log(`   Message: ${data.message}`);
    } else if (response.status === 500) {
      console.log("❌ Status 500 - Internal Server Error (unexpected!)");
      console.log(`   Message: ${data.message}`);
    } else {
      console.log(`⚠️  Status ${response.status}`);
      console.log(`   Message: ${data.message}`);
    }

  } catch (error: any) {
    console.error("Test failed with error:");
    console.error(error?.message || String(error));
  }
}

testTranscribeEndpoint();
