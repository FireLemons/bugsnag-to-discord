import axios from 'axios'

const clc = require('cli-color')
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
const bugsnagAuthHeader = {
    Authorization: `token ${config.bugsnagAuthToken}`
}
let { pollIntervalInMinutes, printBugsnagEventsToConsole } = config
pollIntervalInMinutes = pollIntervalInMinutes ? pollIntervalInMinutes : 30

let failedAttemptCount = 0

function getBugsnagEventDetails(eventID: string): Promise<axios.AxiosResponse> {
    if (typeof eventID !== 'string') {
        logger.error('eventID must be a string')
        throw new TypeError('param eventID is not a string')
    }

    if (!eventID.length) {
        logger.error('Empty string eventID')
        throw new RangeError('param eventID is empty string')
    }

    return axios.get(`https://api.bugsnag.com/projects/${config.bugsnagProjectID}/events/${eventID}`, {
        headers: bugsnagAuthHeader
    })
}

function listBugsnagEvents(): Promise<axios.AxiosResponse> {
    return axios.get(`https://api.bugsnag.com/projects/${config.bugsnagProjectID}/events`, {
        headers: bugsnagAuthHeader
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
**Time:** ${formattedTime}`

    if (message.length > DISCORD_MESSAGE_LENGTH_LIMIT){
        while (message.length > DISCORD_MESSAGE_LENGTH_LIMIT - 4) {
            message = message.substring(message.lastIndexOf("\n") + 1, -1) 
        }

        message = message + '\n...'
    }

    return message
}

function sendDiscordMessage (message: string): Promise<axios.AxiosResponse> {
    return axios.post(`https://discord.com/api/webhooks/${config.discordWebhookID}/${config.discordWebhookToken}`,
    {
        content: message
    })
}

setInterval(() => {
    const currentTime = new Date()

    listBugsnagEvents().then((response) => {
        const bugsnagEventListResponseStatus = response.status
        const bugsnagEventList = response.data

        if (bugsnagEventListResponseStatus < 200 && 300 <= bugsnagEventListResponseStatus) {
            throw new Error(`Response status not success: Instead: ${bugsnagEventListResponseStatus}`)
        }

        logger.info('Response:')

        if (!(bugsnagEventList instanceof Array)) {
            logger.error(`Unexpected Bugsnag data response. Expected array got ${typeof bugsnagEventList}`)
            throw new TypeError('Bugsnag event list response not array')
        }

        const errorEventsInPollWindow: EventBugsnag[] = bugsnagEventList.filter((errorEvent: EventBugsnag) => {
            return currentTime.valueOf() - new Date(errorEvent.received_at).valueOf() <= 1000 * 60 * (pollIntervalInMinutes + (pollIntervalInMinutes * failedAttemptCount))
        })

        const eventCount: number = errorEventsInPollWindow.length

        logger.info(`Found ${eventCount} events in the last 30 minutes`)

        if (!eventCount) {
            return
        }

        for(const bugsnagEvent of errorEventsInPollWindow) {
            getBugsnagEventDetails(bugsnagEvent.id).then((bugsnagDetailedEventResponse: axios.AxiosResponse) => {
                let responseStatus = bugsnagDetailedEventResponse.status

                if (responseStatus < 200 && 300 <= responseStatus) {
                    throw new Error(`Response status not success: Instead: ${responseStatus}`)
                }

                const formattedMessage = formatDiscordMessage(bugsnagDetailedEventResponse.data)

                sendDiscordMessage(formattedMessage)
                .then((discordResponse) => {
                    const discordResponseStatus = discordResponse.status

                    if (discordResponseStatus < 200 && 300 <= discordResponseStatus) {
                        throw new Error(`Response status not success: Instead: ${discordResponseStatus}`)
                    } else {
                        logger.info('Discord message sent')
                        failedAttemptCount = 0

                        if (printBugsnagEventsToConsole) {
                            logger.info('Message:')
                            console.log(formattedMessage)
                        }
                    }
                })
                .catch((error) => {
                    logger.error('Discord Error:')
                    console.error(error)
                    failedAttemptCount++
                })
            })
        }

        console.log(errorEventsInPollWindow)
    }).catch((error) => {
        logger.error('Failed to list Bugsnag events')
        console.error(error)
        failedAttemptCount++
    })
}, pollIntervalInMinutes * 1000 * 60)