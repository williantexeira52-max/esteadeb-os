const cp = require('child_process');
console.log(cp.execSync('git log -p firebase-applet-config.json').toString());
