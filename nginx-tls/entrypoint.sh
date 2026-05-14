#!/bin/sh
set -e

CERT_DIR=/certs
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/server.crt" ]; then
    echo "[mcp-tls] Generating self-signed TLS certificate for localhost..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" \
        -subj "/CN=localhost/O=excalidraw-mcp" \
        -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" 2>/dev/null
    chmod 644 "$CERT_DIR/server.crt"
    chmod 600 "$CERT_DIR/server.key"
    echo "[mcp-tls] Certificate written to $CERT_DIR/server.crt"
    echo "[mcp-tls] Trust it on Windows (run PowerShell as Admin):"
    echo "  Import-Certificate -FilePath \$PWD\\certs\\server.crt -CertStoreLocation Cert:\\LocalMachine\\Root"
else
    echo "[mcp-tls] Using existing certificate from $CERT_DIR"
fi

exec nginx -g 'daemon off;'
