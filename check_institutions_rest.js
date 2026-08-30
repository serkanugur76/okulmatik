import fs from 'fs';

const CONFIG_PATH = '/Users/serkan_ugur/.config/configstore/firebase-tools.json';
const projectId = 'okulmatik-50dc8';

async function run() {
  let accessToken;
  try {
    const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    accessToken = configData.tokens?.access_token;
  } catch (err) {
    console.error("Error reading token:", err.message);
    return;
  }

  const authHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/kurumlar`, {
      headers: authHeaders
    });
    
    if (!res.ok) {
      const err = await res.json();
      console.error("Error fetching institutions:", err);
      return;
    }

    const data = await res.json();
    console.log("Firestore institutions list:");
    if (data.documents) {
      data.documents.forEach(doc => {
        const fields = doc.fields || {};
        const id = doc.name.split('/').pop();
        const ad = fields.ad?.stringValue || 'N/A';
        const tip = fields.tip?.stringValue || 'N/A';
        const googleAltyapisi = fields.googleAltyapisi?.booleanValue || false;
        const parentId = fields.parentId?.stringValue || 'N/A';
        console.log(`- ID: ${id} | Name: ${ad} | Type: ${tip} | Google Workspace: ${googleAltyapisi} | Parent: ${parentId}`);
      });
    } else {
      console.log("No institutions found.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
