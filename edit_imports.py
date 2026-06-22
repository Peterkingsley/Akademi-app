file_path = './akademi-backend/src/modules/ai/ai.service.ts'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
inserted = False
for line in lines:
    if not inserted and 'import { ReplyMode } from \'@prisma/client\';' in line:
        new_lines.append("import { ReplyMode, Prisma } from '@prisma/client';\n")
        inserted = True
    elif 'import { ReplyMode } from \'@prisma/client\';' in line:
        continue
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
