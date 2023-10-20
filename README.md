# deadman-ping

A Cloudflare worker that creates Instatus Incidents when your services stop
sending pings/heartbeats. Default ping interval is 15s (incident created after
twice the interval passed).

## Setup

1. Clone this repo
2. Create a D1 database
3. Run the command in `schema.sql` to create the required table
4. Update the database name and id in `wrangler.toml`
5. Update the routes field in `wrangler.toml` to your domain[^1]
6. Deploy using `wrangler deploy`
7. Add your [instatus api key](https://dashboard.instatus.com/developer) using
   `wrangler secret put INSTATUS_API_KEY`
8. Add your [services](#add-service)

[^1]:
    I do not recommend using your `.workers.dev` domain due to Certificate
    Transparency logs which cause a lot of scrapers to visit you.

## Add service

To add a service you need to add a new row in the D1 table.

- service is a human readable name that is used in the ping URL
- pageId is your Instatus pageId (check your URL)
- componentId is your Instatus component that you want incidents for

Example:

```sql
INSERT INTO LastPing (service, pageId, componentId) VALUES ("example", "...", "...");
```

## Send a ping/heartbeat

Send a request to your worker domain with your service name as path. HTTP method
is irrelevant.

Example:

```sh
curl https://ping.leodev.cloud/example
```

Example won't work because I secured mine with a WAF rule that checks for a
hardcoded `Authorization` header.
