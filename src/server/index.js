// @flow
import { StaticRouter } from 'react-router-dom'

import React from 'react'
import express from 'express'
import session from 'express-session'
import connectRedis from 'connect-redis'
import passport from 'passport'
import { renderToString } from 'react-dom/server'
import { Provider } from 'react-redux'
import serialize from 'serialize-javascript'
import mongoose from 'mongoose'
import shortid from 'shortid'

import ReactRoutes from '../common/routes'
import AuthRouter from './routers/AuthRouter'
import ApiRouter from './routers/ApiRouter'

import { INVITE_URL, SUPPORT_INVITE_URL } from '../common/globals'

import configureStore from '../common/store/configureStore'

mongoose.connect(process.env.RAZZLE_MONGO_URL || 'mongodb://localhost/GrimoireWeb')

const RedisSessionStore = connectRedis(session)

const assets = require(process.env.RAZZLE_ASSETS_MANIFEST)

const app = express()
app.disable('x-powered-by')

app.use(express.static(process.env.RAZZLE_PUBLIC_DIR))
app.use(require('body-parser').urlencoded({ extended: true }))
app.use(require('body-parser').json())

app.use(session({
  secret: shortid(),
  store: new RedisSessionStore({ url: process.env.RAZZLE_REDIS_URL || 'redis://localhost:6379/' })
}))
app.use(passport.initialize())
app.use(passport.session())

app.use('/auth', AuthRouter)

app.use('/api', ApiRouter)

app.get('/invite', (req, res) => { res.redirect(INVITE_URL) })

app.get('/support', (req, res) => { res.redirect(SUPPORT_INVITE_URL) })

app.get('/*', (req, res) => {
  const store = configureStore({
    dashboard: {
      user: req.user
    }
  })

  const context = {}
  const markup = renderToString(
    <Provider store={store}>
      <StaticRouter context={context} location={req.url}>
        <ReactRoutes location={req.location} />
      </StaticRouter>
    </Provider>
  )

  const finalState = store.getState()

  if (context.url) {
    res.redirect(context.url)
  } else {
    res.status(200).send(
      `<!doctype html>
        <html lang="">
          <head>
              <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
              <meta charSet='utf-8' />
              <title>Mac's Grimoire</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              ${assets.client.css ? `<link rel="stylesheet" href="${assets.client.css}">` : ''}
              <script src="${assets.client.js}" defer></script>
          </head>
          <body>
              <div id="root">${markup}</div>
              <script>
                window.__PRELOADED_STATE__ = ${serialize(finalState)}
              </script>    
          </body>
        </html>`
    )
  }
})

export default app
