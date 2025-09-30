# 🚀 Deploy Airbnb Scraper API to Ubuntu VPS

Complete guide to deploy your Airbnb Listings Scraper API on an Ubuntu VPS (DigitalOcean, AWS EC2, Linode, etc.)

---

## 📋 Prerequisites

- Ubuntu 20.04 or 22.04 VPS
- Root or sudo access
- Domain name (optional, but recommended)
- Minimum 2GB RAM, 2 CPU cores

---

## 🔧 Step 1: Initial Server Setup

### 1.1 Connect to Your VPS

```bash
ssh root@your-server-ip
```

### 1.2 Update System

```bash
apt update && apt upgrade -y
```

### 1.3 Create a New User (Optional but Recommended)

```bash
adduser airbnb
usermod -aG sudo airbnb
su - airbnb
```

---

## 📦 Step 2: Install Dependencies

### 2.1 Install Node.js 18+

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### 2.2 Install Playwright Dependencies

```bash
# Install system dependencies for Playwright browsers
sudo apt install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0
```

### 2.3 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 2.4 Install Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx
```

---

## 📂 Step 3: Deploy Your Application

### 3.1 Clone or Upload Your Code

**Option A: Using Git**
```bash
cd ~
git clone https://github.com/your-username/airbnb-listings-finder.git
cd airbnb-listings-finder
```

**Option B: Using SCP from Local Machine**
```bash
# Run this on your local machine
scp -r /path/to/airbnb-listings-finder root@your-server-ip:/home/airbnb/
```

### 3.2 Install Dependencies

```bash
cd ~/airbnb-listings-finder
npm install
```

### 3.3 Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3.4 Create Environment File

```bash
nano .env
```

Add the following configuration:

```env
# API Server Configuration
PORT=3000
NODE_ENV=production

# Authentication - CHANGE THESE!
# Generate secure tokens: openssl rand -hex 32
API_TOKENS=your-secure-token-1,your-secure-token-2

# Rate Limiting
MIN_DELAY_BETWEEN_REQUESTS=3000
MAX_DELAY_BETWEEN_REQUESTS=8000

# Scraper Configuration
MAX_LISTINGS_PER_REQUEST=100
DEFAULT_NUMBER_OF_LISTINGS=10

# Logging
LOG_LEVEL=info
```

**Generate Secure Tokens:**
```bash
# Generate a random token
openssl rand -hex 32
```

Save and exit (Ctrl+X, then Y, then Enter)

---

## 🔄 Step 4: Run with PM2

### 4.1 Start the Application

```bash
pm2 start npm --name "airbnb-api" -- run api
```

### 4.2 Configure PM2 Startup

```bash
# Save PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Copy and run the command that PM2 outputs
```

### 4.3 Useful PM2 Commands

```bash
# View logs
pm2 logs airbnb-api

# Monitor
pm2 monit

# Restart
pm2 restart airbnb-api

# Stop
pm2 stop airbnb-api

# Delete
pm2 delete airbnb-api

# List all processes
pm2 list
```

---

## 🌐 Step 5: Configure Nginx Reverse Proxy

### 5.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/airbnb-api
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or server IP

    # Increase timeouts for long-running scraping requests
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
    proxy_read_timeout 300;
    send_timeout 300;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase client body size for large requests
    client_max_body_size 10M;
}
```

Save and exit.

### 5.2 Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/airbnb-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 🔒 Step 6: Setup SSL with Let's Encrypt (Optional but Recommended)

### 6.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Obtain SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### 6.3 Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up a cron job for renewal
```

---

## 🔥 Step 7: Configure Firewall

### 7.1 Setup UFW (Uncomplicated Firewall)

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP
sudo ufw allow 'Nginx HTTP'

# Allow HTTPS
sudo ufw allow 'Nginx HTTPS'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## ✅ Step 8: Test Your Deployment

### 8.1 Health Check

```bash
curl http://your-domain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "Airbnb Listings Scraper API",
  "version": "1.0.0",
  "timestamp": "2025-09-30T20:00:00.000Z",
  "authentication": "enabled"
}
```

### 8.2 Test API with Authentication

```bash
curl -X POST http://your-domain.com/api/scrape/listing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-token-1" \
  -d '{"listingId": "12345678"}'
```

---

## 📊 Step 9: Monitoring & Logs

### 9.1 View Application Logs

```bash
# Real-time logs
pm2 logs airbnb-api

# Last 100 lines
pm2 logs airbnb-api --lines 100

# Error logs only
pm2 logs airbnb-api --err
```

### 9.2 View Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### 9.3 Monitor System Resources

```bash
# CPU and Memory
pm2 monit

# System resources
htop
```

---

## 🔧 Step 10: Maintenance & Updates

### 10.1 Update Application

```bash
cd ~/airbnb-listings-finder

# Pull latest changes (if using Git)
git pull

# Install new dependencies
npm install

# Restart application
pm2 restart airbnb-api
```

### 10.2 Backup

```bash
# Backup your .env file
cp .env .env.backup

# Backup entire application
tar -czf airbnb-api-backup-$(date +%Y%m%d).tar.gz ~/airbnb-listings-finder
```

---

## 🚨 Troubleshooting

### Issue: Application Won't Start

```bash
# Check PM2 logs
pm2 logs airbnb-api

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart PM2
pm2 restart airbnb-api
```

### Issue: Nginx 502 Bad Gateway

```bash
# Check if application is running
pm2 list

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart airbnb-api
sudo systemctl restart nginx
```

### Issue: Playwright Browsers Not Working

```bash
# Reinstall Playwright browsers
npx playwright install chromium --with-deps

# Check system dependencies
npx playwright install-deps
```

### Issue: Out of Memory

```bash
# Check memory usage
free -h

# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 🎯 Performance Optimization

### 1. Increase Node.js Memory Limit

Edit PM2 ecosystem file:

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'airbnb-api',
    script: 'src/api/server.js',
    instances: 1,
    exec_mode: 'fork',
    node_args: '--max-old-space-size=2048',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Then start with:
```bash
pm2 start ecosystem.config.js
```

### 2. Enable Nginx Caching (Optional)

Add to Nginx config:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location / {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    # ... rest of proxy settings
}
```

---

## 📱 API Usage After Deployment

### With cURL

```bash
curl -X POST https://your-domain.com/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-token-1" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 10
  }'
```

### With JavaScript/Node.js

```javascript
const response = await fetch('https://your-domain.com/api/scrape/listing', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secure-token-1'
  },
  body: JSON.stringify({
    listingId: '12345678'
  })
});

const data = await response.json();
console.log(data);
```

---

## 🎉 Deployment Complete!

Your Airbnb Scraper API is now:
- ✅ Running on Ubuntu VPS
- ✅ Managed by PM2 (auto-restart on crash)
- ✅ Behind Nginx reverse proxy
- ✅ Protected with SSL (if configured)
- ✅ Secured with API token authentication
- ✅ Auto-starts on server reboot

### Quick Reference

| Service | Command |
|---------|---------|
| Start API | `pm2 start airbnb-api` |
| Stop API | `pm2 stop airbnb-api` |
| Restart API | `pm2 restart airbnb-api` |
| View Logs | `pm2 logs airbnb-api` |
| Restart Nginx | `sudo systemctl restart nginx` |
| Check Status | `pm2 status` |

---

## 📞 Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs airbnb-api`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables: `cat .env`
4. Test locally first before deploying

---

**🎊 Congratulations! Your API is live and ready to use!**
