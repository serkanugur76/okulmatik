import crypto from 'crypto';

// Helper to sign JWT using Node.js crypto
function signJWT(payload, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(privateKey, 'base64url');
  return `${signatureInput}.${signature}`;
}

async function getAccessToken(serviceAccount) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: exp,
    iat: iat
  };
  
  const jwt = signJWT(payload, serviceAccount.private_key);
  
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  if (!res.ok) {
    throw new Error('OAuth token exchange failed: ' + (await res.text()));
  }
  
  const data = await res.json();
  return data.access_token;
}

// Fetch the latest versions from Firestore to determine the next version number
async function getLatestVersions(projectId, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'versiyonlar' }],
      orderBy: [{
        field: { fieldPath: 'olusturmaTarihi' },
        direction: 'DESCENDING'
      }],
      limit: 5
    }
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(query)
  });
  
  if (!res.ok) {
    console.warn('Could not fetch latest versions, defaulting to v1.5.0: ' + (await res.text()));
    return [];
  }
  
  const data = await res.json();
  // Firestore runQuery returns an array of { document: ... }
  return data
    .filter(item => item.document)
    .map(item => {
      const doc = item.document;
      const fields = doc.fields || {};
      return {
        id: doc.name.split('/').pop(),
        versiyon: fields.versiyon?.stringValue || 'v1.5.0',
        baslik: fields.baslik?.stringValue || '',
      };
    });
}

// Write the new version document to Firestore
async function writeVersionDoc(projectId, token, versionDoc) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/versiyonlar`;
  
  // Format versionDoc fields for Firestore REST format
  const fields = {
    versiyon: { stringValue: versionDoc.versiyon },
    baslik: { stringValue: versionDoc.baslik },
    tarih: { stringValue: versionDoc.tarih },
    rozet: { stringValue: versionDoc.rozet || '' },
    renk: { stringValue: versionDoc.renk || '#10B981' },
    bg: { stringValue: versionDoc.bg || '#ECFDF5' },
    commitHash: { stringValue: versionDoc.commitHash || '' },
    olusturmaTarihi: { timestampValue: new Date().toISOString() },
    maddeler: {
      arrayValue: {
        values: versionDoc.maddeler.map(m => ({
          mapValue: {
            fields: {
              tip: { stringValue: m.tip },
              baslik: { stringValue: m.baslik },
              detay: { stringValue: m.detay }
            }
          }
        }))
      }
    }
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  
  if (!res.ok) {
    throw new Error('Failed to write document to Firestore: ' + (await res.text()));
  }
  
  console.log('✅ Document successfully written to Firestore!');
}

async function main() {
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saEnv) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable is not defined.');
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(saEnv);
  const projectId = serviceAccount.project_id;
  
  const commitMsg = process.env.COMMIT_MSG || 'fix: push updates';
  const commitHash = process.env.COMMIT_HASH || '';
  
  console.log('🔑 Authenticating with Firebase...');
  const token = await getAccessToken(serviceAccount);
  
  console.log('🔍 Fetching latest version details...');
  const latestDocs = await getLatestVersions(projectId, token);
  
  // Determine current latest version string
  let latestVer = '1.5.0';
  if (latestDocs.length > 0) {
    const raw = latestDocs[0].versiyon.replace(/^v/, '');
    if (/^\d+\.\d+\.\d+$/.test(raw)) {
      latestVer = raw;
    }
  }
  
  // Parse commit message
  // First line is the title
  const lines = commitMsg.split('\n').map(l => l.trim()).filter(Boolean);
  const titleLine = lines[0] || 'Sistem Güncellemesi';
  
  // Determine target version
  let targetVer = '';
  // Check if commit message starts with tag like [v1.6.0] or v1.6.0
  const tagMatch = titleLine.match(/^\[?v?(\d+\.\d+\.\d+)\]?/i);
  let cleanTitle = titleLine;
  
  if (tagMatch) {
    targetVer = 'v' + tagMatch[1];
    cleanTitle = titleLine.replace(/^\[?v?\d+\.\d+\.\d+\]?\s*/i, '').trim();
  } else {
    // Auto increment patch version
    const parts = latestVer.split('.').map(Number);
    parts[2] = parts[2] + 1; // Increment patch
    targetVer = 'v' + parts.join('.');
  }
  
  console.log(`📌 Next version determined as: ${targetVer}`);
  
  // Parse bullet points for maddeler
  const maddeler = [];
  const bulletLines = lines.slice(1);
  
  bulletLines.forEach(line => {
    if (line.startsWith('-') || line.startsWith('*')) {
      const cleanLine = line.substring(1).trim();
      let tip = 'opt';
      let baslik = cleanLine;
      let detay = '';
      
      // Parse prefix like "yenilik:", "duzeltme:", "iyilestirme:"
      const prefixMatch = cleanLine.match(/^(yenilik|duzeltme|opt|iyileştirme|iyilestirme|fix)\s*:\s*(.*)$/i);
      if (prefixMatch) {
        const rawTip = prefixMatch[1].toLowerCase();
        if (rawTip === 'yenilik') tip = 'yenilik';
        else if (rawTip === 'duzeltme' || rawTip === 'fix') tip = 'duzeltme';
        else tip = 'opt';
        
        baslik = prefixMatch[2].trim();
      }
      
      // Split into title and detail if there is a dash or paren
      const splitIdx = baslik.indexOf(' - ');
      if (splitIdx > -1) {
        detay = baslik.substring(splitIdx + 3).trim();
        baslik = baslik.substring(0, splitIdx).trim();
      } else if (baslik.length > 50) {
        // If too long, use first 50 chars as title, rest as details
        detay = baslik;
        baslik = baslik.substring(0, 50) + '...';
      }
      
      maddeler.push({ tip, baslik, detay });
    }
  });
  
  // Fallback if no bullet points parsed
  if (maddeler.length === 0) {
    let tip = 'opt';
    if (cleanTitle.toLowerCase().startsWith('fix:') || cleanTitle.toLowerCase().startsWith('bug:')) {
      tip = 'duzeltme';
    } else if (cleanTitle.toLowerCase().startsWith('feat:') || cleanTitle.toLowerCase().startsWith('new:')) {
      tip = 'yenilik';
    }
    maddeler.push({
      tip,
      baslik: cleanTitle,
      detay: 'GitHub push tetiklemesiyle otomatik oluşturulmuş sürüm.'
    });
  }
  
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = new Date().toLocaleDateString('tr-TR', options);
  
  const versionDoc = {
    versiyon: targetVer,
    baslik: cleanTitle,
    tarih: formattedDate,
    rozet: targetVer.endsWith('.0') ? 'Ana Sürüm' : '',
    renk: targetVer.endsWith('.0') ? '#3B82F6' : '#10B981',
    bg: targetVer.endsWith('.0') ? '#EFF6FF' : '#ECFDF5',
    commitHash: commitHash,
    maddeler: maddeler
  };
  
  console.log('Writing to Firestore...', JSON.stringify(versionDoc, null, 2));
  await writeVersionDoc(projectId, token, versionDoc);
}

main().catch(err => {
  console.error('❌ Error executing script:', err);
  process.exit(1);
});
