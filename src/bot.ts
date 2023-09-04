import * as https from "node:https"

const clc = require('cli-color')
const CronJob = require('cron').CronJob
const fs = require('fs')

const logger = {
    info: (message: string) => {
        console.log(clc.cyan(message))
    },
    error: (message: string) => {
        console.log(clc.red(message))
    },
    warn: (message: string) => {
        console.log(clc.yellow(message))
    }

}

const config = JSON.parse(fs.readFileSync('./config.json'))

function pollBugsnag () {
    return https.request
}

const pollBugsnagAndForwardToDiscord = new CronJob(
    config.pollIntervalAsCronString,
    () => {
        logger.info(config)
    }
)

pollBugsnagAndForwardToDiscord.start()