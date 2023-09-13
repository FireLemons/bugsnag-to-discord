import * as https from "node:https"

const clc = require('cli-color')
const CronJob = require('cron').CronJob
const fs = require('fs')

type EventBugsnag = {
    app: {
        releaseStage: string
    }
    context: string
    exceptions: [
        {
            errorClass: string
            message: string
            stacktrace: [
                {
                    file: string
                    in_project: boolean
                    line_number: number
                    code: {
                        [name: string] : string
                    }
                }
            ]
        }
    ]
    id: string
    received_at: string
    request: {
        url: string
    }
    url: string
    user: {
        email: string
        id: string
    }
}

type EventBugsnagDetailed = EventBugsnag /* Type Intersection Operator -> */ & { // Used here to extend EventBugsnag into EventBugsnagDetailed
    exceptions: [{
        stacktrace: [{
            file: string
            in_project: boolean | null
            line_number: number
        }]
    }]
    user: {
        email: string
    }
}

const DISCORD_MESSAGE_LENGTH_LIMIT = 2000

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

function getBugsnagEventDetails(eventID: string): Promise<EventBugsnagDetailed> {
    return new Promise((resolve, reject) => {
        if (typeof eventID !== 'string') {
            logger.error('eventID must be a string')
            reject(new TypeError('param eventID is not a string'))
        }

        if (!eventID.length) {
            logger.error('Empty string eventID')
            reject(new RangeError('param eventID is empty string'))
        }

        let buffer: Uint8Array[] = []

        https.request({
            headers: {
                Authorization: `token ${config.bugsnagAuthToken}`
            },
            hostname: 'api.bugsnag.com',
            path: `/projects/${config.bugsnagProjectID}/events/${eventID}`
        },
        (response) => {
            const { statusCode } = response

            if (statusCode < 200 && 300 <= statusCode) {
                logger.error(`Bugsnag event details data request returned with unsuccessful status: ${statusCode}`)
                reject(response)
            }

            response.on('data', (chunk) => {
                buffer.push(chunk)
            }).on('end', () => {
                let bugsnagData: EventBugsnagDetailed

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

function listBugsnagEvents(): Promise<EventBugsnag[]> {
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
                logger.error(`Bugsnag event data request returned with unsuccessful status: ${statusCode}`)
                reject(response)
            }

            response.on('data', (chunk) => {
                buffer.push(chunk)
            }).on('end', () => {
                let bugsnagData: EventBugsnag[]

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

function formatDiscordMessage (bugsnagEvent: EventBugsnagDetailed): string {
    const anonymizedEmail = /(@.*)/.exec(bugsnagEvent.user.email)[0]
    const matchedTimeSubstrings = /(.*):[\d]{2} GMT-[\d]{4} (\(.*\))/.exec(new Date(bugsnagEvent.received_at).toString())
    const formattedTime = `${matchedTimeSubstrings[1]} ${matchedTimeSubstrings[2]}`

    const onlyException = bugsnagEvent.exceptions[0]
    const relevantProjectFiles = onlyException.stacktrace.filter((subroutine) => {
        return subroutine.in_project
    })

    let stacktrace = ''

    for (const projectFile of relevantProjectFiles) {
        stacktrace = stacktrace +
// Keep these template literals against the left. They preserve whitespace.
`  **File:** ${projectFile.file}:${projectFile.line_number}
\`\`\`ruby
`
        for (const line of Object.values(projectFile.code)) {
            stacktrace = stacktrace + line + '\n'
        }

        stacktrace = stacktrace + '```\n'
    }

    let message =
`**Environment:** ${bugsnagEvent.app.releaseStage}
**Message**: ${onlyException.message}
**Error URL:** ${bugsnagEvent.url}
**Stack:**
${stacktrace}
**Controller:** ${bugsnagEvent.context}
**Affected User:** xxx${anonymizedEmail}, ${bugsnagEvent.user.id}
**App URL:** ${bugsnagEvent.request.url}
**Time:** ${formattedTime}
`

    if (message.length > DISCORD_MESSAGE_LENGTH_LIMIT){
        while (message.length > DISCORD_MESSAGE_LENGTH_LIMIT - 4) {
            message = message.substring(message.lastIndexOf("\n") + 1, -1) 
        }

        message = message + '\n...'
    }

    return message
}

const detailedTestingEvent: EventBugsnagDetailed = JSON.parse(fs.readFileSync('./sample_detailed_event.json'))

logger.info('Discord Message:')
console.log(formatDiscordMessage(detailedTestingEvent))

//const pollBugsnagAndForwardToDiscord = new CronJob(
//    `0/30 * * * *`, // Every 30 minutes at XX:00 and XX:30
//    () => {
        // const currentTime = new Date()

        // listBugsnagEvents().then((response) => {            
        //     logger.info('Response:')

        //     if (!(response instanceof Array)) {
        //         logger.error(`Unexpected Bugsnag data response. Expected array got ${typeof response}`)
        //         return
        //     }

        //     const errorEventsInLast30Minutes: EventBugsnag[] = response.slice(0, 1)/*filter((errorEvent: EventBugsnag) => {
        //         return currentTime.valueOf() - new Date(errorEvent.received_at).valueOf() <= 1000 * 60 * 30
        //     })*/

        //     const eventCount: number = errorEventsInLast30Minutes.length

        //     logger.info(`Found ${eventCount} events in the last 30 minutes`)

        //     if (!eventCount) {
        //         return
        //     }

        //     for(const bugsnagEvent of errorEventsInLast30Minutes) {
        //         getBugsnagEventDetails(bugsnagEvent.id).then((bugsnagDetailedEvent: EventBugsnagDetailed) => {
        //             console.log(JSON.stringify(bugsnagDetailedEvent))
        //         })
        //     }

        //     console.log(errorEventsInLast30Minutes)
        // }).catch((error) => {
        //     logger.error('Failed to list Bugsnag events')
        //     console.error(error)
        // })
//    }
//)

//pollBugsnagAndForwardToDiscord.start()
