import fs from 'fs';
import path from 'path';

function fixCreateFileRoute(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixCreateFileRoute(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      const routeMatch = content.match(/export\s+const\s+Route\s*=\s*createFileRoute\([^)]*\)\(\s*\{\s*component:\s*([\s\S]*?)\s*\}\s*\);?/);
      if (routeMatch) {
        let componentStr = routeMatch[1].trim();
        if (componentStr.endsWith(',')) componentStr = componentStr.slice(0, -1);
        content = content.replace(routeMatch[0], `export default ${componentStr};`);
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

fixCreateFileRoute(path.join(process.cwd(), 'src/app'));
console.log('Done');
