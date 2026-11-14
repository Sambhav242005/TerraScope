import fs from 'node:fs';

const cssPath = 'src/style.css';
let content = fs.readFileSync(cssPath, 'utf8');

const target = `.resource-pin {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid white;
  background: #487d68;
  color: white;
  font-size: 20px;
  box-shadow: 0 2px 7px #193b3340;
}`;

const replacement = `.resource-pin {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid white;
  background: #487d68;
  color: white;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 2px 7px #193b3340;
}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(cssPath, content, 'utf8');
  console.log('Successfully updated .resource-pin with LF match');
} else {
  // Try CRLF
  const targetCRLF = target.replace(/\n/g, '\r\n');
  const replacementCRLF = replacement.replace(/\n/g, '\r\n');
  if (content.includes(targetCRLF)) {
    content = content.replace(targetCRLF, replacementCRLF);
    fs.writeFileSync(cssPath, content, 'utf8');
    console.log('Successfully updated .resource-pin with CRLF match');
  } else {
    console.error('Target not found in style.css');
  }
}
