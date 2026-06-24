# Database Access (DBeaver)

To connect to the Akademi Postgres database using DBeaver or any other database client, use the following credentials:

- **Host:** dpg-d6v9oafafjfc73ctj08g-a.oregon-postgres.render.com
- **Port:** 5432
- **Database:** akademi
- **Username:** akademi_user
- **Password:** [Retrieve from Render Dashboard](https://dashboard.render.com/d/dpg-d6v9oafafjfc73ctj08g-a)
- **SSL Mode:** Required (Set SSL mode to 'require' or 'verify-full' in DBeaver)

## Security Note
The IP allow list is currently set to allow connections from anywhere (`0.0.0.0/0`). If you want to restrict access, you can update the IP allow list in the Render Dashboard under the "Connect" button for the Postgres instance.
