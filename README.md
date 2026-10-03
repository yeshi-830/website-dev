# EduManage Student System

The frontend uses React and Vite. The Express API stores student records in MySQL.

## Database setup

1. Create the database named by `DB_NAME` in your local `.env` file.
2. Run `database/schema.sql` against that database.
3. Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and optionally `DB_PORT` in `.env`.

## Run locally

Start the API in one terminal:

```sh
npm run server
```

Start the React development server in another terminal:

```sh
npm run dev
```

Open the URL printed by Vite. Its `/api` requests are proxied to the Express server on port 5000. Check the database connection at `/api/health`.

For a production frontend bundle, run `npm run build`.