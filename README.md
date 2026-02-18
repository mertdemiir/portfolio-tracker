<p align="center">
  <img src="public/logo.png" width="120" alt="Portfolio Tracker logo" />
</p>

<h1 align="center">Portfolio Tracker</h1>

<p align="center">
  A desktop app to track your entire net worth — stocks, ETFs, crypto, precious metals, real estate, and more — all in one place.
</p>

<p align="center">
  <a href="https://github.com/mertdemiir/portfolio-tracker/releases/latest">Download for Mac & Windows</a>
</p>

---

## Features

- **Multi-asset tracking** — Stocks, ETFs, crypto, precious metals, cash, real estate, vehicles, and custom categories
- **Live prices** — Real-time quotes from Finnhub (stocks/ETFs) and CoinGecko (crypto)
- **Dashboard** — Net worth summary, portfolio value, total P&L, today's change, and top movers
- **Charts** — Allocation pie chart, category breakdown, portfolio history, net worth over time, gain/loss per holding
- **Holdings table** — Sortable list with current price, market value, cost basis, gain/loss %, daily change, and allocation
- **Net worth snapshots** — Automatic daily tracking of your total net worth over time
- **Custom categories** — Define your own asset categories beyond the defaults
- **Offline-first** — All data stored locally on your machine

## Download

Grab the latest release for your platform:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `Portfolio Tracker-*-arm64.dmg` |
| macOS (Intel) | `Portfolio Tracker-*-x64.dmg` |
| Windows | `Portfolio Tracker Setup *.exe` |

> **macOS note:** Since the app isn't code-signed, right-click the app and select "Open" the first time.

## Getting Started

1. Download and install the app
2. On first launch, you'll be prompted to enter a free [Finnhub API key](https://finnhub.io/register) for live stock/ETF prices (optional — crypto prices work without it)
3. Start adding your holdings

## Development

```bash
# Install dependencies
npm install

# Run in browser
npm run dev

# Run as Electron app
npm run electron:dev

# Build distributable
npm run electron:build
```

## Tech Stack

React, TypeScript, Tailwind CSS, Vite, Electron, Recharts

## License

MIT
