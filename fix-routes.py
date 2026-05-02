import os
import re

def fix_routes(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.jsx'):
                full_path = os.path.join(root, file)
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Match export const Route = createFileRoute(...)({ component: ... })
                pattern = re.compile(r'export\s+const\s+Route\s*=\s*createFileRoute\([^)]*\)\(\s*\{\s*component:\s*([\s\S]*?)\s*\}\s*\);?')
                match = pattern.search(content)
                if match:
                    comp_str = match.group(1).strip()
                    if comp_str.endswith(','):
                        comp_str = comp_str[:-1]
                    new_content = content[:match.start()] + f'export default {comp_str};' + content[match.end():]
                    with open(full_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Fixed {full_path}")

fix_routes(os.path.join(os.getcwd(), 'src/app'))
