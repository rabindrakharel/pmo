#!/bin/bash

# Voice Orchestrator Test Script
# Tests STT, TTS, and complete voice flow

set -e

API_URL="${API_URL:-http://localhost:4000}"
API_TEST_EMAIL="${API_TEST_EMAIL:-james.miller@huronhome.ca}"
API_TEST_PASSWORD="${API_TEST_PASSWORD:-password123}"

echo "🎙️ Voice Orchestrator Test Script"
echo "=================================="
echo ""

# Get auth token
echo "🔐 Authenticating..."
TOKEN=$(curl -s -X POST "${API_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${API_TEST_EMAIL}\",\"password\":\"${API_TEST_PASSWORD}\"}" \
  | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo "✅ Authenticated successfully"
echo ""

# Test 1: Get available voices
echo "📢 Test 1: Get Available Voices"
echo "--------------------------------"
curl -s "${API_URL}/api/v1/chat/orchestrator/voices" | jq '.'
echo ""

# Test 2: Text-to-Speech
echo "🔊 Test 2: Text-to-Speech"
echo "-------------------------"
echo "Generating speech audio..."
curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello! This is a test of the voice orchestrator system.","voice":"nova"}' \
  --output /tmp/voice-test-tts.mp3

if [ -f /tmp/voice-test-tts.mp3 ]; then
  FILE_SIZE=$(stat -f%z /tmp/voice-test-tts.mp3 2>/dev/null || stat -c%s /tmp/voice-test-tts.mp3)
  FILE_TYPE=$(file /tmp/voice-test-tts.mp3)
  echo "✅ TTS audio generated: ${FILE_SIZE} bytes"
  echo "   File type: ${FILE_TYPE}"
  echo "   Saved to: /tmp/voice-test-tts.mp3"
else
  echo "❌ TTS failed"
  exit 1
fi
echo ""

# Test 3: Speech-to-Text (requires audio file)
if [ -f "/tmp/test-audio.webm" ] || [ -f "/tmp/test-audio.wav" ]; then
  echo "🎤 Test 3: Speech-to-Text"
  echo "-------------------------"
  AUDIO_FILE="/tmp/test-audio.webm"
  [ -f "/tmp/test-audio.wav" ] && AUDIO_FILE="/tmp/test-audio.wav"

  echo "Testing with: ${AUDIO_FILE}"
  curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/stt" \
    -F "file=@${AUDIO_FILE}" | jq '.'
  echo ""
else
  echo "⏭️  Test 3: Speech-to-Text (SKIPPED - no audio file found)"
  echo "   Place a test audio file at /tmp/test-audio.webm or /tmp/test-audio.wav to test STT"
  echo ""
fi

# Test 4: Complete Voice Flow (requires audio file)
if [ -f "/tmp/test-audio.webm" ] || [ -f "/tmp/test-audio.wav" ]; then
  echo "🎙️ Test 4: Complete Voice Flow (STT → Orchestrator → TTS)"
  echo "-----------------------------------------------------------"
  AUDIO_FILE="/tmp/test-audio.webm"
  [ -f "/tmp/test-audio.wav" ] && AUDIO_FILE="/tmp/test-audio.wav"

  echo "Processing voice message..."
  RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/voice" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "file=@${AUDIO_FILE}" \
    -F "voice=nova" \
    --dump-header /tmp/voice-headers.txt \
    --output /tmp/voice-response.mp3)

  if [ -f /tmp/voice-response.mp3 ]; then
    echo "✅ Voice processing complete"
    echo ""
    echo "Response Headers:"
    grep "^X-" /tmp/voice-headers.txt | while read -r line; do
      KEY=$(echo "$line" | cut -d: -f1)
      VALUE=$(echo "$line" | cut -d: -f2- | xargs)

      # URL decode if it starts with %
      if [[ "$VALUE" == *"%"* ]]; then
        VALUE=$(printf '%b' "${VALUE//%/\\x}")
      fi

      echo "  ${KEY}: ${VALUE}"
    done
    echo ""

    FILE_SIZE=$(stat -f%z /tmp/voice-response.mp3 2>/dev/null || stat -c%s /tmp/voice-response.mp3)
    echo "Response audio: ${FILE_SIZE} bytes"
    echo "Saved to: /tmp/voice-response.mp3"
  else
    echo "❌ Voice processing failed"
    exit 1
  fi
  echo ""
else
  echo "⏭️  Test 4: Complete Voice Flow (SKIPPED - no audio file found)"
  echo "   Place a test audio file at /tmp/test-audio.webm or /tmp/test-audio.wav to test complete flow"
  echo ""
fi

echo "✅ Voice orchestrator tests complete!"
echo ""
echo "To test with real audio:"
echo "1. Record audio: sox -d -r 16000 -c 1 /tmp/test-audio.wav trim 0 5"
echo "2. Or use browser to record and save as /tmp/test-audio.webm"
echo "3. Run this script again"
