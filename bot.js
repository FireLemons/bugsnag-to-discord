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
const DISCORD_MESSAGE_LENGTH_LIMIT = 2000;
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
function getBugsnagEventDetails(eventID) {
    return new Promise((resolve, reject) => {
        if (typeof eventID !== 'string') {
            logger.error('eventID must be a string');
            reject(new TypeError('param eventID is not a string'));
        }
        if (!eventID.length) {
            logger.error('Empty string eventID');
            reject(new RangeError('param eventID is empty string'));
        }
        let buffer = [];
        https.request({
            headers: {
                Authorization: `token ${config.bugsnagAuthToken}`
            },
            hostname: 'api.bugsnag.com',
            path: `/projects/${config.bugsnagProjectID}/events/${eventID}`
        }, (response) => {
            const { statusCode } = response;
            if (statusCode < 200 && 300 <= statusCode) {
                logger.error(`Bugsnag event details data request returned with unsuccessful status: ${statusCode}`);
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
function listBugsnagEvents() {
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
                logger.error(`Bugsnag event data request returned with unsuccessful status: ${statusCode}`);
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
function formatDiscordMessage(bugsnagEvent) {
    const anonymizedEmail = /(@.*)/.exec(bugsnagEvent.user.email)[0];
    const matchedTimeSubstrings = /(.*):[\d]{2} GMT-[\d]{4} (\(.*\))/.exec(new Date(bugsnagEvent.received_at).toString());
    const formattedTime = `${matchedTimeSubstrings[1]} ${matchedTimeSubstrings[2]}`;
    const onlyException = bugsnagEvent.exceptions[0];
    const relevantProjectFiles = onlyException.stacktrace.filter((subroutine) => {
        return subroutine.in_project;
    });
    let stacktrace = '';
    for (const projectFile of relevantProjectFiles) {
        stacktrace = stacktrace +
            `  **File:** ${projectFile.file}:${projectFile.line_number}
\`\`\`ruby
`;
        for (const line of Object.values(projectFile.code)) {
            stacktrace = stacktrace + line + '\n';
        }
        stacktrace = stacktrace + '```\n';
    }
    let message = `**Environment:** ${bugsnagEvent.app.releaseStage}
**Message**: ${onlyException.message}
**Error URL:** ${bugsnagEvent.url}
**Stack:**
${stacktrace}
**Controller:** ${bugsnagEvent.context}
**Affected User:** xxx${anonymizedEmail}, ${bugsnagEvent.user.id}
**App URL:** ${bugsnagEvent.request.url}
**Time:** ${formattedTime}
`;
    if (message.length > DISCORD_MESSAGE_LENGTH_LIMIT) {
        while (message.length > DISCORD_MESSAGE_LENGTH_LIMIT - 4) {
            message = message.substring(message.lastIndexOf("\n") + 1, -1);
        }
        message = message + '\n...';
    }
    return message;
}
const detailedTestingEvent = JSON.parse(fs.readFileSync('./sample_detailed_event.json'));
logger.info('Discord Message:');
console.log(formatDiscordMessage(detailedTestingEvent));
//# sourceMappingURL=bot.js.map