import fs from 'fs';
import path from 'path';

function addUseClientToPages(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      addUseClientToPages(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      if (file === 'layout.tsx') continue;
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (!content.includes('"use client"') && !content.includes("'use client'")) {
        fs.writeFileSync(fullPath, '"use client";\n\n' + content);
      }
    }
  }
}

addUseClientToPages(path.join(process.cwd(), 'src/app'));
console.log('use client added to all pages.');
