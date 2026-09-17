#!/usr/bin/env bash
# Prepare Mac signing + notarization materials for CI.
# Works around electron-builder #10066 on macOS 26+: CSC_LINK signing fails because
# set-key-partition-list is given the .p12 password instead of the temp keychain password.
# Fix: import the .p12 into our own keychain and let identity auto-discovery sign.
set -euo pipefail

: "${CSC_LINK_B64:?CSC_LINK_B64 is required}"
: "${CSC_KEY_PASSWORD:?CSC_KEY_PASSWORD is required}"
: "${APPLE_API_KEY:?APPLE_API_KEY is required}"
: "${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required}"
: "${APPLE_API_ISSUER:?APPLE_API_ISSUER is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"

P12_PATH="${RUNNER_TEMP}/developer-id.p12"
KEYCHAIN="${RUNNER_TEMP}/betterdb-signing.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -base64 32)"

if printf '%s' "$CSC_LINK_B64" | head -c 40 | grep -q "BEGIN"; then
  echo "::error::CSC_LINK looks like PEM text. Export Developer ID Application as a .p12, then base64-encode that file."
  exit 1
fi

printf '%s' "$CSC_LINK_B64" | tr -d '\n\r\t ' | base64 --decode > "$P12_PATH"
chmod 600 "$P12_PATH"
if [ ! -s "$P12_PATH" ]; then
  echo "::error::Decoded CSC_LINK is empty. Re-encode with: base64 -i YourCert.p12 | tr -d '\\n' | pbcopy"
  exit 1
fi

if ! openssl pkcs12 -in "$P12_PATH" -passin pass:"$CSC_KEY_PASSWORD" -noout >/dev/null 2>&1 \
  && ! openssl pkcs12 -in "$P12_PATH" -passin pass:"$CSC_KEY_PASSWORD" -noout -legacy >/dev/null 2>&1; then
  echo "::error::CSC_KEY_PASSWORD does not unlock the .p12 in CSC_LINK (or CSC_LINK is not a valid .p12)."
  exit 1
fi
echo "Verified .p12 unlocks ($(wc -c < "$P12_PATH" | tr -d ' ') bytes)"

security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"

security import "$P12_PATH" \
  -k "$KEYCHAIN" \
  -P "$CSC_KEY_PASSWORD" \
  -T /usr/bin/codesign \
  -T /usr/bin/security \
  -T /usr/bin/productbuild

security set-key-partition-list \
  -S apple-tool:,apple:,codesign: \
  -s \
  -k "$KEYCHAIN_PASSWORD" \
  "$KEYCHAIN"

# Prepend our keychain to the user search list (keep existing keychains).
EXISTING="$(security list-keychains -d user | sed -e 's/"//g')"
# shellcheck disable=SC2086
security list-keychains -d user -s "$KEYCHAIN" $EXISTING

if ! security find-identity -v -p codesigning "$KEYCHAIN" | grep -q "Developer ID Application"; then
  echo "::error::Developer ID Application identity not found after keychain import"
  security find-identity -v -p codesigning "$KEYCHAIN" || true
  exit 1
fi
echo "Signing identities available:"
security find-identity -v -p codesigning "$KEYCHAIN"

KEY_PATH="${RUNNER_TEMP}/AuthKey_${APPLE_API_KEY_ID}.p8"
if printf '%s' "$APPLE_API_KEY" | grep -q "BEGIN PRIVATE KEY"; then
  printf '%s\n' "$APPLE_API_KEY" > "$KEY_PATH"
else
  printf '%s' "$APPLE_API_KEY" | tr -d '\n\r\t ' | base64 --decode > "$KEY_PATH"
fi
chmod 600 "$KEY_PATH"
if [ ! -s "$KEY_PATH" ]; then
  echo "::error::APPLE_API_KEY decoded to an empty file"
  exit 1
fi

echo "Validating App Store Connect API key with notarytool…"
if ! xcrun notarytool history \
  --key "$KEY_PATH" \
  --key-id "$APPLE_API_KEY_ID" \
  --issuer "$APPLE_API_ISSUER" >/tmp/notary-history.txt 2>&1; then
  echo "::error::notarytool rejected APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER"
  echo "Check that APPLE_API_KEY_ID matches the Key ID for this .p8, and APPLE_API_ISSUER is the Team Issuer UUID (not your Team ID)."
  sed 's/[^[:print:][:space:]]/?/g' /tmp/notary-history.txt | tail -40 || true
  exit 1
fi
echo "notarytool credentials OK"

{
  echo "APPLE_API_KEY_PATH=$KEY_PATH"
  echo "KEYCHAIN_PATH=$KEYCHAIN"
  echo "KEYCHAIN_PASSWORD=$KEYCHAIN_PASSWORD"
} >> "$GITHUB_ENV"

echo "Mac signing keychain + notarization key ready"
