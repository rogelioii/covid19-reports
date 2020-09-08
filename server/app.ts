import express from 'express';
import https from 'https';
import fs from 'fs';
import 'express-async-errors';
import process from 'process';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
// import expressSession from 'express-session';
import morgan from 'morgan';
import path from 'path';
import apiRoutes from './api';
import database from './sqldb';
import {requireUserAuth} from "./auth";
import {errorHandler} from "./util/error";

database.then(() => {
  console.log('Database ready');
});

if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

const app = express();

//
// Middlware
//

app.use(requireUserAuth);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
// app.use(expressSession({
//   resave: false,
//   saveUninitialized: false,
//   store: new TypeormStore({
//     cleanupLimit: 2,
//     ttl: 86400
//   }).connect(Session.repo),
//   secret: process.env.SESSION_SECRET,
// }))
app.use(passport.initialize());
app.use(passport.session())
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('tiny'));
}

// passport.serializeUser((user: User, done) => {
//   done(null, user.serialize())
// })
//
// passport.deserializeUser((userData: UserSerialized, done) => {
//   done(null, new User().deserialize(userData))
// })

//
// Routes
//
app.get('/heartbeat', (req: express.Request, res: express.Response) => {
  res.status(204).send();
});

app.use('/api', apiRoutes);

app.get('/*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Not found
// app.all('*', (req: express.Request, res: express.Response) => {
//   res.status(404).send({
//     error: {
//       message: 'Not found.',
//       type: 'NotFound',
//     },
//   });
// });

// app.use('*', express.static('public'));

// Error handler
app.use(errorHandler);

let serverKeyPath = process.env.SERVER_KEY || path.join(__dirname, 'certs/server.key');
let serverCertPath = process.env.SERVER_CERT || path.join(__dirname, 'certs/server.crt');

let certificateAuthorities: string[] = [];
if (process.env.CERTIFICATE_AUTHORITIES) {
  certificateAuthorities = process.env.CERTIFICATE_AUTHORITIES.split(',');
} else {
  certificateAuthorities.push(path.join(__dirname, 'certs/ca.crt'));
}

//
// Start the server
//
const opts = {
  key: fs.readFileSync(serverKeyPath),
  cert: fs.readFileSync(serverCertPath),
  requestCert: true,
  rejectUnauthorized: true,
  ca: certificateAuthorities.map((ca) => fs.readFileSync(ca))
};
if (process.env.NODE_ENV === 'development') {
  opts.rejectUnauthorized = false;
}
const PORT = process.env.PORT || 4000;
https.createServer(opts, app).listen(PORT, () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`🚀 Server ready at https://localhost:${PORT}`);
  }
});

export default app;
