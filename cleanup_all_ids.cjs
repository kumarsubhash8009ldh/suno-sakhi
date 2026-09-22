const https = require('https');

const PROJECT_ID = 'suno-sakhi-63040';
const COLLECTIONS = ['hosts', 'host_accounts', 'user_accounts', 'users', 'calls', 'conversations'];

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getCollectionDocs(collection) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=100`;
  const res = await request(url);
  if (res.body && Array.isArray(res.body.documents)) {
    return res.body.documents.map((d) => d.name);
  }
  return [];
}

async function deleteDoc(docPath) {
  const url = `https://firestore.googleapis.com/v1/${docPath}`;
  const res = await request(url, { method: 'DELETE' });
  return res.status === 200;
}

async function cleanup() {
  console.log('🧹 [FIRESTORE CLEANUP] Starting complete wipe of test collections...');
  for (const coll of COLLECTIONS) {
    let docPaths = await getCollectionDocs(coll);
    console.log(`📂 Collection "${coll}": Found ${docPaths.length} documents.`);
    for (const p of docPaths) {
      const docId = p.split('/').pop();
      const success = await deleteDoc(p);
      console.log(`  🗑️ Deleted [${coll}/${docId}]: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
  }
  console.log('✅ [FIRESTORE CLEANUP] All collections wiped successfully.');
}

cleanup().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
