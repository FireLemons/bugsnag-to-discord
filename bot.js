var clc = require('cli-color');
var fs = require('fs');
var logger = {
    info: function (message) {
        console.log(clc.cyan(message));
    },
    error: function (message) {
        console.log(clc.red(message));
    },
    warn: function (message) {
        console.log(clc.yellow(message));
    }
};
var https;
try {
    https = require('node:https');
}
catch (err) {
    console.error(err);
    throw new Error('https support is disabled');
}
var result = JSON.parse(fs.readFileSync('./config.json'));
logger.info(result);
//# sourceMappingURL=bot.js.map