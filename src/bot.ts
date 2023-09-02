const clc = require('cli-color')
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

let https

try {
    https = require('node:https')
} catch (err) {
    console.error(err)
    throw new Error('https support is disabled')
}

const result = JSON.parse(fs.readFileSync('./config.json'))

logger.info(result)