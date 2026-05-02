import fs from 'fs';
import path from 'path';

function addUseClient(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      addUseClient(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (!content.includes('"use client"') && !content.includes("'use client'")) {
        fs.writeFileSync(fullPath, '"use client";\n\n' + content);
      }
      
      // Also fix any lingering "@/../" import bugs in these files
      if (content.includes('@/../')) {
         content = content.replace(/@\/\.\.\//g, '@/');
         fs.writeFileSync(fullPath, content);
      }
    }
  }
}

addUseClient(path.join(process.cwd(), 'src/components'));
addUseClient(path.join(process.cwd(), 'src/context'));
addUseClient(path.join(process.cwd(), 'src/hooks'));
addUseClient(path.join(process.cwd(), 'src/layouts'));
console.log('use client added.');
