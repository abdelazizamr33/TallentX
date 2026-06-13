const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetDir = 'd:/Projects/Grad-project/ourfront/TallentX/src/app/pages';

walkDir(targetDir, function(filePath) {
  if (filePath.endsWith('.html')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split('\n');
    let modified = false;
    for (let i = 0; i < lines.length; i++) {
      if ((lines[i].includes('min-h-screen') || lines[i].includes('min-h-[calc(100vh-4rem)]')) && lines[i].includes('bg-surface-container-lowest')) {
        lines[i] = lines[i].replace('bg-surface-container-lowest', 'bg-surface');
        modified = true;
      }
    }
    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log('Updated ' + filePath);
    }
  }
});
