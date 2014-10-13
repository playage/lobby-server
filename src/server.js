const debug = require('debug')('aocmulti:server')

// require() debug
const _r = require
require = function (path) {
  debug('require', path)
  return _r(path)
}

debug('starting')

require('./fn').install(global)

const http = require('http')
    , path = require('path')
    , fs = require('fs')

// Web site stuff
    , express = require('express')
    , cookieParser = require('cookie-parser')
    //, bodyParser = require('body-parser')
    , session = require('express-session')
    , csurf = require('csurf')
    , logger = require('morgan')
    , lessMiddleware = require('less-middleware')
    , pp = require('passport')
    , qs = require('qs')

    , sql = require('./sql')
    , api = require('./api')
    , config = require('../config')

// set up Handlebars helpers
const Handlebars = require('handlebars')
require('./handlebars-helpers')(Handlebars)

// set up auth
require('./passport')(pp)

// App setup
const app = express()

// meh
app.disable('x-powered-by')

if (true|| config.env === 'production') {
  const RedisStore = require('connect-redis')(session)
  app.sessionStore = new RedisStore(config.redis)
}
else {
  app.sessionStore = new session.MemoryStore()
}

app.passport = pp

//app.use(logger())
app.use(cookieParser())
//app.use(bodyParser.urlencoded({ extended: true }))
app.use(function (req, res, next) {
  var txt = ''
  req.on('data', function (ch) { txt += ch })
  req.on('end', function () {
    req.body = qs.parse(txt)
    next()
  })
})
app.use(session({
  secret: config.cookie_secret
, key: 'sid'
, store: app.sessionStore
, resave: true
, saveUninitialized: true
}))
app.use(lessMiddleware(__dirname + '/public'))

app.use(pp.initialize())
app.use(pp.session())

// View stuff
app.engine('handlebars', function (view, options, callback) {
  fs.readFile(view, { encoding: 'utf8' }, function (err, hbs) {
    if (err) return callback(err)
    callback(null, Handlebars.compile(hbs)(options))
  })
})
app.set('view engine', 'handlebars')
app.set('views', path.join(__dirname, 'templates'))
app.locals.config = config

app.use(require('./routes/index')())
app.use(require('./routes/register')())

// Web App API
app.use('/_', require('./routes/web-api')())
// Client API
app.use('/client', require('./routes/client-api')())

// static
app.use(express.static(__dirname + '/public'))

const server = http.createServer(app)
if (config.socket) {
  const io = require('socket.io')(server)
  require('./socket-api')(app, io)
}

server.listen(config.port, function () {
  console.log('Listening on port %d', server.address().port)
  debug('memusage: ' + (process.memoryUsage().rss / 1024 / 1024).toPrecision(4) + 'MB')
})

setInterval(function () {
  debug('memusage: ' + (process.memoryUsage().rss / 1024 / 1024).toPrecision(4) + 'MB')
}, 30000)
