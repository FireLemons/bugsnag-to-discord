# Bugsnag to Discord
Long polls bugsnag errors and posts them to discord via web hook

## Setup
`npm i`

## Developing
`npm run build` compile typescript into js  
`npm run build:dev` compile javascript into js and watch for changes

## Config
in a file in the project root called `config.json`
```
{
    "bugsnagAuthToken": "",
    "bugsnagProjectID": "",
    "discordWebhookID": "",
    "discordWebhookToken": "",
    "pollIntervalInMinutes": 30, // Optional default 30
    "printBugsnagEventsToConsole": true // Optional default false
}
```
