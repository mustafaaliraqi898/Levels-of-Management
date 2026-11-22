import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const publicDir = path.join(root, 'public');
await fs.mkdir(publicDir, { recursive: true });
const svg = await fs.readFile(path.join(publicDir, 'icon.svg'));
const png = await sharp(svg).resize(256, 256).png().toBuffer();
await fs.writeFile(path.join(publicDir, 'icon.png'), await sharp(svg).resize(512, 512).png().toBuffer());
await fs.writeFile(path.join(publicDir, 'icon.ico'), await pngToIco([png]));
console.log('Generated transparent Windows app icons (PNG 512px / ICO 256px).');
