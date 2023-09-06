"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const https = __importStar(require("node:https"));
const clc = require('cli-color');
const CronJob = require('cron').CronJob;
const fs = require('fs');
const logger = {
    info: (message) => {
        console.log(clc.cyan(message));
    },
    error: (message) => {
        console.log(clc.red(message));
    },
    warn: (message) => {
        console.log(clc.yellow(message));
    }
};
const config = JSON.parse(fs.readFileSync('./config.json'));
function pollBugsnag() {
    return new Promise((resolve, reject) => {
        let buffer = [];
        https.request({
            headers: {
                Authorization: `token ${config.bugsnagAuthToken}`
            },
            hostname: 'api.bugsnag.com',
            path: `/projects/${config.bugsnagProjectID}/events`
        }, (response) => {
            const { statusCode } = response;
            if (statusCode < 200 && 300 <= statusCode) {
                reject(response);
            }
            response.on('data', (chunk) => {
                buffer.push(chunk);
            }).on('end', () => {
                let bugsnagData;
                try {
                    bugsnagData = JSON.parse(Buffer.concat(buffer).toString());
                }
                catch (error) {
                    reject(error);
                    return;
                }
                resolve(bugsnagData);
            });
        }).on('error', (error) => {
            reject(error);
        }).end();
    });
}
const pollBugsnagAndForwardToDiscord = new CronJob(`0/10 * * * *`, () => {
    pollBugsnag().then((response) => {
        logger.info('Response:');
        console.log(response);
    }).catch((error) => {
        logger.error('Failure:');
        console.error(error);
    });
});
pollBugsnagAndForwardToDiscord.start();
//# sourceMappingURL=bot.js.map