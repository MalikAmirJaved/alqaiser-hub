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
      
      // Remove any leftover import of createFileRoute
      content = content.replace(/import\s*{\s*createFileRoute\s*}\s*from\s*["']@tanstack\/react-router["'];?\n?/g, '');
      
      // Match export const Route = createFileRoute(...)({ component: ... })
      const routeMatch = content.match(/export\s+const\s+Route\s*=\s*createFileRoute\([^)]*\)\(\s*\{\s*component:\s*([\s\S]*?)\s*\}\s*\);?/);
      if (routeMatch) {
        const componentStr = routeMatch[1].trim();
        // Remove trailing comma if present
        let cleanComponentStr = componentStr;
        if (cleanComponentStr.endsWith(',')) {
            cleanComponentStr = cleanComponentStr.slice(0, -1);
        }
        
        content = content.replace(routeMatch[0], `export default ${cleanComponentStr};`);
        fs.writeFileSync(fullPath, content);
        console.log(`Fixed ${fullPath}`);
      }
    }
  }
}

fixCreateFileRoute(path.join(process.cwd(), 'src/app'));
console.log('Done fixing route exports.');
