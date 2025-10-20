import session from 'express-session';
import MongoStore from 'connect-mongo';

export const configureSession = () => {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devops_todo_sessions';
  const sessionSecret = process.env.SESSION_SECRET || 'devops-todo-secret-change-me';

  return session({
    name: 'devops.todo.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 7,
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  });
};
