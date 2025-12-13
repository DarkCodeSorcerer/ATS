// Script to create .env file for frontend
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = `VITE_API_URL=https://ats-w53t.onrender.com
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created frontend/.env file');
  console.log('📝 VITE_API_URL=https://ats-w53t.onrender.com');
} else {
  console.log('⚠️  frontend/.env already exists');
  console.log('📝 Please verify it contains:');
  console.log('   VITE_API_URL=https://ats-w53t.onrender.com');
}

