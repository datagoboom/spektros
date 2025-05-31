import express from 'express';
import { BrowserWindow } from 'electron';

class CallHomeServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = 5666;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Add CORS headers if needed
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      next();
    });
  }

  setupRoutes() {
    this.app.post('/call-home', (req, res) => {
      let data = req.body;
      console.log(data);

      // Get client IP address from request
      const clientIp = req.ip || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress || 
                      req.connection.socket?.remoteAddress;

      // Convert IPv6 loopback to IPv4 if needed
      const ipv4Address = clientIp === '::1' ? '127.0.0.1' : 
                         clientIp === '::ffff:127.0.0.1' ? '127.0.0.1' :
                         clientIp.replace(/^::ffff:/, ''); // Remove IPv6 prefix if present

      const appInfo = {
        uuid: data.uuid,
        name: data.app_name,
        lastSeen: Date.now(),
        timestamp: data.timestamp,
        active_jobs: data.active_jobs,
        ip: ipv4Address,
        port: data.port,
        ipc_monitor_port: data.ipc_monitor_port || null,
        console_port: data.console_port || null
      }

      console.log(`📞 Call-home received from ${appInfo.name} (${appInfo.uuid}) at ${ipv4Address}`);

      // Send to all renderer processes immediately
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('call-home-data', appInfo);
        }
      });

      return res.status(200).json({ success: true, received: Date.now() });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: Date.now(),
        connectedWindows: BrowserWindow.getAllWindows().length
      });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      if (this.server && this.server.listening) {
        console.log(`Call Home Server already running on port ${this.port}`);
        resolve(this.port);
        return;
      }

      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          console.error(`❌ Failed to start Call Home Server:`, err);
          reject(err);
        } else {
          console.log(`✅ Call Home Server running on port ${this.port}`);
          resolve(this.port);
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server && this.server.listening) {
        this.server.close(() => {
          console.log('🛑 Call Home Server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isRunning() {
    return this.server && this.server.listening;
  }

  getPort() {
    return this.port;
  }

  setPort(newPort) {
    this.port = newPort;
  }
}

export const callHomeServer = new CallHomeServer();