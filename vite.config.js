import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import nodemailer from 'nodemailer'
import { execSync } from 'child_process'

function getVersionInfo() {
  let commitHash = 'unknown'
  let commitDate = ''
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim()
    commitDate = execSync('git log -1 --format=%cd --date=format:"%Y-%m-%d"').toString().trim()
  } catch (e) {
    // Git bilgisi alınamazsa sessizce devam et
  }
  const dateStr = commitDate ? ` (${commitDate})` : ''
  const packageVersion = process.env.npm_package_version || '0.1.0'
  return {
    version: packageVersion,
    hash: commitHash,
    full: `${packageVersion}-${commitHash}${dateStr}`
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'send-email-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/send-email' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const data = JSON.parse(body);
                const { host, port, username, password, to, from, subject, htmlBody } = data;

                const transporter = nodemailer.createTransport({
                  host,
                  port: parseInt(port, 10),
                  secure: port === '465' || port === 465,
                  auth: {
                    user: username,
                    pass: password
                  },
                  tls: {
                    rejectUnauthorized: false
                  }
                });

                const info = await transporter.sendMail({
                  from,
                  to,
                  subject,
                  html: htmlBody
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, messageId: info.messageId }));
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
  server: { port: 3000 },
  define: {
    __APP_VERSION_INFO__: JSON.stringify(getVersionInfo())
  }
})
