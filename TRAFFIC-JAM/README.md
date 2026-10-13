# TRAFFIC JAM

A colourful, lightweight real-time grid game for short facilitated activities. Active rooms live only in server memory: no accounts, database, or deployment-specific infrastructure.

## Run locally

1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and set a facilitator password.
4. Run `npm start`, then open `http://localhost:3000`.

For people on the same Wi-Fi, share the computer's local network URL (for example `http://192.168.x.x:3000`) and their room link. Some networks block device-to-device traffic.

## Test

Run `npm test`. The tests cover grid bounds, orthogonal movement, occupancy, room capacity, and replay setup.

## Notes

- Game state is intentionally temporary. Restarting the server closes all rooms.
- The facilitator password is checked on the server. It is supplied through the `FACILITATOR_PASSWORD` environment variable; the example value is only a local-development default.
- The facilitator chooses a room size of one to five human players. The game keeps the combined human-and-bot setup to eight or fewer players so all starts and destinations fit on the grid.
