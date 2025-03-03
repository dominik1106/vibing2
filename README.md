# Vibing2
This is the v2 of discord-youtube music bot. While the first one was written in python, this one was created with discord.js, since it played nicer with a REST-API, which is the big feature of this one.

It features a web UI (using ejs SSR) that enables the users to control the playback. It authentificates users with discord's oauth2 API.

## Dependencies
- discord.js (https://github.com/discordjs/discord.js)
- Distube (https://github.com/skick1234/DisTube)
- express (https://github.com/expressjs/express)
  - express-session (https://github.com/expressjs/session)
  - ejs (https://github.com/mde/ejs)
- socket.io (https://github.com/socketio/socket.io)
- (Soon) Redis

## Features
- Regular control via slash commands
- A REST-API
- socket.io updates on every state change

## Install
The easiest way to install this bot yourself is to use Docker, with the included Dockerfile.
Currently does not provide any SSL capabilities itself, use in conjuction with a reverse proxy like nginx or apache2.

It requires the following enviroment variables to function:
- `BOT_TOKEN` The discord bot token
- `CLIENT_ID` The discord bot client id, used for oauth2
- `SESSION_SECRET` Used to encrypt the express-sessions
- `URL` The URL used to access the frontend and API
- `PORT` (Optional) the port that the express http server listens on, defaults to `4321`
