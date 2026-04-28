#!/bin/bash
# Sudoclaw QMS Deployment Script

set -e

APP_NAME="sudoclaw-qms"
DEPLOY_DIR="/opt/$APP_NAME"
DATA_DIR="/var/lib/$APP_NAME"
LOG_DIR="/var/log/$APP_NAME"
SERVICE_USER="qms"
SERVICE_GROUP="qms"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root"
    exit 1
fi

# Create service user if not exists
if ! id "$SERVICE_USER" &>/dev/null; then
    log_info "Creating service user: $SERVICE_USER"
    useradd -r -s /bin/false "$SERVICE_USER"
fi

# Create directories
log_info "Creating directories..."
mkdir -p "$DEPLOY_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

# Set permissions
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DATA_DIR"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
chmod 750 "$DATA_DIR"
chmod 750 "$LOG_DIR"

# Copy application files
log_info "Copying application files..."
cp -r dist "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp .env.production "$DEPLOY_DIR/.env" 2>/dev/null || log_warn "No .env.production found, please configure manually"

# Set application permissions
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DEPLOY_DIR"
chmod 755 "$DEPLOY_DIR/dist"

# Create systemd service file
log_info "Creating systemd service..."
cat > /etc/systemd/system/$APP_NAME.service << EOF
[Unit]
Description=Sudoclaw Quality Management System
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/local/bin/bun run dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/stdout.log
StandardError=append:$LOG_DIR/stderr.log

# Environment
Environment=NODE_ENV=production
Environment=DB_PATH=$DATA_DIR/qms.db
Environment=PORT=6078
Environment=HOST=0.0.0.0

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR $LOG_DIR

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
log_info "Enabling and starting service..."
systemctl daemon-reload
systemctl enable $APP_NAME
systemctl start $APP_NAME

# Check status
sleep 3
if systemctl is-active --quiet $APP_NAME; then
    log_info "Service started successfully!"
    log_info "Health check: http://localhost:6078/health"
    log_info "API endpoint: http://localhost:6078/api/v1"
else
    log_error "Service failed to start. Check logs at $LOG_DIR"
    systemctl status $APP_NAME
    exit 1
fi

log_info "Deployment completed!"