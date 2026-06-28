import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  // Handle CORS preflight request
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { host, port, username, password, to, from, subject, htmlBody } = req.body

    if (!host || !port || !username || !password || !to || !subject || !htmlBody) {
      return res.status(400).json({ error: 'Eksik parametre gönderildi.' })
    }

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === '465' || port === 465, // true for 465, false for other ports (like 587/25)
      auth: {
        user: username,
        pass: password
      },
      tls: {
        rejectUnauthorized: false // Do not fail on self-signed certificates
      }
    })

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: htmlBody
    })

    return res.status(200).json({ success: true, messageId: info.messageId })
  } catch (err) {
    console.error('SMTP Hatası:', err)
    return res.status(500).json({ error: err.message })
  }
}
