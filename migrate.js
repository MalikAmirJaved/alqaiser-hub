import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'src/routes');
const appDir = path.join(process.cwd(), 'src/app');

// Ensure app directory exists
if (!fs.existsSync(appDir)) {
  fs.mkdirSync(appDir, { recursive: true });
}

function processContent(content) {
  // Remove @tanstack/react-router imports
  content = content.replace(/import\s*{[^}]*createFileRoute[^}]*}\s*from\s*['"]@tanstack\/react-router['"];?\n?/g, '');
  
  // Replace useNavigate
  content = content.replace(/useNavigate\(\)/g, 'useRouter()');
  // We'll need to add import { useRouter } from 'next/navigation' if not present, but we can do a naive replace first
  content = content.replace(/import\s*\{([^}]*)useNavigate([^}]*)\}\s*from\s*['"]@tanstack\/react-router['"]/g, "import { useRouter } from 'next/navigation'");
  
  // Replace Link
  content = content.replace(/<Link\s+to=/g, '<Link href=');
  content = content.replace(/import\s*\{([^}]*)Link([^}]*)\}\s*from\s*['"]@tanstack\/react-router['"]/g, "import Link from 'next/link'");
  
  // Clean up empty tanstack imports
  content = content.replace(/import\s*{\s*}\s*from\s*['"]@tanstack\/react-router['"];?\n?/g, '');

  // Extract component from Route
  const routeMatch = content.match(/export\s+const\s+Route\s*=\s*createFileRoute\([^)]*\)\(\s*\{\s*component:\s*([^,}\n]+)[^}]*\}\s*\);?/);
  if (routeMatch) {
    const componentStr = routeMatch[1].trim();
    content = content.replace(routeMatch[0], `export default ${componentStr};`);
  }

  // Next.js uses client components for hooks
  if (content.includes('useRouter') || content.includes('useState') || content.includes('useEffect') || content.includes('useQuery') || content.includes('useForm')) {
    content = '"use client";\n\n' + content;
  }

  return content;
}

function migrateRoute(file) {
  if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
  if (file === '__root.tsx' || file === '_app.tsx') return; // Handled manually

  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  content = processContent(content);

  let targetPath = '';
  if (file.startsWith('_app.')) {
    // inside (app) group
    const routePath = file.replace('_app.', '').replace('.tsx', '');
    if (routePath === 'index') {
      targetPath = path.join(appDir, '(app)', 'page.tsx');
    } else {
      const parts = routePath.split('.');
      targetPath = path.join(appDir, '(app)', ...parts, 'page.tsx');
    }
  } else if (file === 'login.tsx') {
    targetPath = path.join(appDir, 'login', 'page.tsx');
  } else {
    const routePath = file.replace('.tsx', '');
    targetPath = path.join(appDir, routePath, 'page.tsx');
  }

  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, content);
  console.log(`Migrated ${file} -> ${targetPath}`);
}

const files = fs.readdirSync(routesDir);
files.forEach(migrateRoute);

console.log("Migration script complete.");
