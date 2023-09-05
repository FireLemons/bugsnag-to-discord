import { IncomingMessage } from "node:http"
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

function pollBugsnag (): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
        https.request({
            headers: {
                Authorization: `token ${config.bugsnagAuthToken}`
            },
            hostname: 'api.bugsnag.com',
            path: '/user/organizations?admin=false'
        },
        (response) => {
            const { statusCode } = response

            if (200 <= statusCode && statusCode < 300) {
                resolve(response)
            } else {
                reject(response)
            }
        }).end()
    })
}

/*const pollBugsnagAndForwardToDiscord = new CronJob(
    config.pollIntervalAsCronString,
    () => {
        logger.info(config)
    }
)*/

// pollBugsnagAndForwardToDiscord.start()

pollBugsnag().then((response) => {
    console.log(response)
})