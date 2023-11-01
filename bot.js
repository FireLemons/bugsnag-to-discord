"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const clc = require('cli-color');
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
let { pollIntervalInMinutes, printBugsnagEventsToConsole } = config;
pollIntervalInMinutes = pollIntervalInMinutes ? pollIntervalInMinutes : 30;
let failedAttemptCount = 0;
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
    const matchedTimeSubstrings = /(.*):[\d]{2} GMT-[\d]{4} (\(.*\))/.exec(new Date(bugsnagEvent.received_at).toString());
    const formattedTime = `${matchedTimeSubstrings[1]} ${matchedTimeSubstrings[2]}`;
    const email = bugsnagEvent.user.email;
    let userInfo = '';
    if (email) {
        const anonymizedEmail = /(@.*)/.exec(email)[0];
        userInfo = `**Affected User:** xxx${anonymizedEmail}, ${bugsnagEvent.user.id}`;
    }
    else {
        userInfo = 'Affected user not logged in';
    }
    const onlyException = bugsnagEvent.exceptions[0];
    const relevantProjectFiles = onlyException.stacktrace.filter((subroutine) => {
        return subroutine.in_project;
    });
    let stacktrace = '';
    for (const projectFile of relevantProjectFiles) {
        const fileName = projectFile.file;
        stacktrace = stacktrace +
            `  **File:** ${fileName}:${projectFile.line_number}
\`\`\`${fileName.endsWith('.erb') ? 'erb' : 'ruby'}
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
${userInfo}
**App URL:** ${bugsnagEvent.request.url}
**Time:** ${formattedTime}`;
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
setInterval(() => {
    const currentTime = new Date();
    listBugsnagEvents().then((response) => {
        const bugsnagEventListResponseStatus = response.status;
        const bugsnagEventList = response.data;
        if (bugsnagEventListResponseStatus < 200 && 300 <= bugsnagEventListResponseStatus) {
            throw new Error(`Response status not success: Instead: ${bugsnagEventListResponseStatus}`);
        }
        if (!(bugsnagEventList instanceof Array)) {
            logger.error(`Unexpected Bugsnag data response. Expected array got ${typeof bugsnagEventList}`);
            throw new TypeError('Bugsnag event list response not array');
        }
        const errorEventsInPollWindow = bugsnagEventList.filter((errorEvent) => {
            return currentTime.valueOf() - new Date(errorEvent.received_at).valueOf() <= 1000 * 60 * (pollIntervalInMinutes + (pollIntervalInMinutes * failedAttemptCount));
        });
        logger.info(`Found ${errorEventsInPollWindow.length} events in the last ${pollIntervalInMinutes} minutes`);
        for (const bugsnagEvent of errorEventsInPollWindow) {
            getBugsnagEventDetails(bugsnagEvent.id).then((bugsnagDetailedEventResponse) => {
                const responseStatus = bugsnagDetailedEventResponse.status;
                if (responseStatus < 200 && 300 <= responseStatus) {
                    throw new Error(`Response status not success: Instead: ${responseStatus}`);
                }
                const formattedMessage = formatDiscordMessage(bugsnagDetailedEventResponse.data);
                sendDiscordMessage(formattedMessage)
                    .then((discordResponse) => {
                    const discordResponseStatus = discordResponse.status;
                    if (discordResponseStatus < 200 && 300 <= discordResponseStatus) {
                        throw new Error(`Response status not success: Instead: ${discordResponseStatus}`);
                    }
                    else {
                        logger.info('Discord message sent');
                        failedAttemptCount = 0;
                        if (printBugsnagEventsToConsole) {
                            logger.info('Message:');
                            console.log(formattedMessage);
                        }
                    }
                })
                    .catch((error) => {
                    logger.error('Discord Error:');
                    console.error(error);
                    failedAttemptCount++;
                });
            }).catch((error) => {
                logger.error('Failed to fetch detailed bugsnag event');
                console.error(error);
                failedAttemptCount++;
            });
        }
    }).catch((error) => {
        logger.error('Failed to list Bugsnag events');
        console.error(error);
        failedAttemptCount++;
    });
}, pollIntervalInMinutes * 1000 * 60);
//# sourceMappingURL=bot.js.map