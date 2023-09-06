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

function pollBugsnag (): Promise<Error | IncomingMessage | Object> {
    return new Promise((resolve, reject) => {
        let buffer: Uint8Array[] = []

        https.request({
            headers: {
                Authorization: `token ${config.bugsnagAuthToken}`
            },
            hostname: 'api.bugsnag.com',
            path: `/projects/${config.bugsnagProjectID}/events`
        },
        (response) => {
            const { statusCode } = response

            if (statusCode < 200 && 300 <= statusCode) {
                reject(response)
            }

            response.on('data', (chunk) => {
                buffer.push(chunk)
            }).on('end', () => {
                let bugsnagData: Object

                try {
                    bugsnagData = JSON.parse(Buffer.concat(buffer).toString())
                } catch (error) {
                    reject(error)
                    return
                }

                resolve(bugsnagData)
            })
        }).on('error', (error) => {
            reject(error)
        }).end()
    })
}

const pollBugsnagAndForwardToDiscord = new CronJob(
    `0/10 * * * *`, // Every 10 minutes at 00, 10, 20...
    () => {
        pollBugsnag().then((response) => {
            logger.info('Response:')
            console.log(response)
        }).catch((error) => {
            logger.error('Failure:')
            console.error(error)
        })
    }
)

pollBugsnagAndForwardToDiscord.start()
