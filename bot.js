"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
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
const bugsnagAuthHeader = {
    Authorization: `token ${config.bugsnagAuthToken}`
};
function getBugsnagEventDetails(eventID) {
    if (typeof eventID !== 'string') {
        logger.error('eventID must be a string');
        throw new TypeError('param eventID is not a string');
    }
    if (!eventID.length) {
        logger.error('Empty string eventID');
        throw new RangeError('param eventID is empty string');
    }
    return axios_1.default.get(`https://api.bugsnag.com/projects/${config.bugsnagProjectID}/events/${eventID}`, {
        headers: bugsnagAuthHeader
    });
}
function listBugsnagEvents() {
    return axios_1.default.get(`https://api.bugsnag.com/projects/${config.bugsnagProjectID}/events`, {
        headers: bugsnagAuthHeader
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
function sendDiscordMessage(message) {
    return axios_1.default.post(`https://discord.com/api/webhooks/${config.discordWebhookID}/${config.discordWebhookToken}`, {
        content: message
    });
}
const detailedTestingEvent = JSON.parse(fs.readFileSync('./sample_detailed_event.json'));
logger.info('Discord Message:');
sendDiscordMessage(formatDiscordMessage(detailedTestingEvent))
    .then((discordResponse) => {
    logger.info('Discord Response:');
    console.log(discordResponse);
})
    .catch((error) => {
    logger.error('Discord Error:');
    console.error(error);
});
//# sourceMappingURL=bot.js.map