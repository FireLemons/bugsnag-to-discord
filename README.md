# Bugsnag to Discord
Long polls bugsnag errors and posts them to discord via web hook

## Setup
`npm i`

## Developing
`npm run build` compile typescript into js  
`npm run build:dev` compile javascript into js and watch for changes

## Config
```
{
    "bugsnagAuthToken": "",
    "bugsnagProjectID": "",
    "discordWebhookID": "",
    "discordWebhookToken": "",
    "pollIntervalInMinutes": 30
}
```
