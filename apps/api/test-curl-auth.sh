#!/bin/bash

BASE_URL="http://localhost:8787"

echo "1. Creating User..."
curl -v -X POST "$BASE_URL/api/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "name": "Test User"}'

echo "\n\n2. Signing In..."
COOKIE_JAR=$(mktemp)
curl -v -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

echo "\n\n3. Getting Session..."
curl -v -b "$COOKIE_JAR" "$BASE_URL/api/auth/session"

echo "\n\n4. Accessing Protected Data..."
curl -v -b "$COOKIE_JAR" "$BASE_URL/api/protected"

rm "$COOKIE_JAR"
