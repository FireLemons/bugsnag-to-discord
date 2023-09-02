let https;

try {
  https = require('node:https');
} catch (err) {
  console.error('https support is disabled!');
} 