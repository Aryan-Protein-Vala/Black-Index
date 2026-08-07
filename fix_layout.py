with open('app/layout.tsx', 'r') as f:
    content = f.read()

content = content.replace('import { Inter } from "next/font/google"', '')
new_inter = 'const inter = { className: "" }'
content = content.replace('const inter = Inter({\n  subsets: ["latin"],\n  weight: ["300", "400", "500", "600"],\n})', new_inter)

with open('app/layout.tsx', 'w') as f:
    f.write(content)

