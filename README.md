<p align="center">
  <img src="public/logo.png" width="120" alt="Portfolio Tracker logo" />
</p>

<h1 align="center">Portfolio Tracker</h1>

<p align="center">
  A desktop app to track your entire net worth — stocks, ETFs, crypto, precious metals, real estate, liabilities, and more — all in one place.
</p>

<p align="center">
  <a href="https://github.com/mertdemiir/portfolio-tracker/releases/latest">Download for Mac & Windows</a>
</p>

---

## Features

### Core
- **Multi-asset tracking** — Stocks, ETFs, crypto, precious metals, cash, real estate, vehicles, and custom categories
- **Live prices** — Real-time quotes from Finnhub (stocks/ETFs) and CoinGecko (crypto), auto-refresh every 5 minutes
- **Offline-first** — All data stored locally on your machine, no account needed

### Dashboard
- Net worth summary with assets vs liabilities breakdown
- Portfolio value, total P&L, today's change, and top movers
- Net worth by category with percentage breakdown
- Milestones with progress bars
- Dashboard stats reflect the active portfolio selection

### Holdings
- Sortable, searchable holdings table with current price, market value, cost basis, gain/loss %, daily change, and allocation
- Drag-and-drop reordering, favorites, asset type and category filters
- Manual price overrides for custom assets
- Move holdings between portfolios
- CSV import/export

### Charts & Analytics
- **Net worth timeline** — Historical net worth with time range filters (1M, 3M, 6M, 1Y, ALL)
- **Benchmark overlays** — Compare your performance against S&P 500, Bitcoin, or Gold
- **Allocation pie chart** — Portfolio allocation by holding
- **Category breakdown** — Net worth by category
- **Gain/loss bar chart** — Per-holding performance
- **Treemap** — Hierarchical allocation with daily change heatmap
- **Currency exposure** — Asset breakdown by currency
- **Drawdown chart** — Peak-to-trough analysis
- **Rolling returns** — Return analysis by rolling period
- **Allocation vs targets** — Current allocation vs your target percentages
- **Monthly/yearly summary** — Period-based performance metrics

### Net Worth & Liabilities
- Net worth = total assets - total liabilities
- **Liabilities tracking** — Mortgage, auto loan, student loan, credit card, personal loan, and custom types
- Interest rate and minimum payment tracking per liability
- Automatic daily snapshots with manual snapshot support

### Portfolios
- Multiple portfolio buckets within your net worth
- Create, rename, and delete portfolios
- Transfer holdings across portfolios
- Portfolio-specific stats and charts
- "All" view combining everything

### Timeline Annotations
- Add date-based annotations to the net worth chart
- Custom labels and colors
- Toggle visibility on/off

### Transactions
- Buy/sell transaction log with date, ticker, shares, price, and notes
- Filter by type and ticker, sort by any column
- Ticker autocomplete from your holdings

### Simulator
- Price shock scenarios and hypothetical portfolio adjustments
- Impact analysis on your portfolio

### Watchlist
- Track securities without owning them
- Live price monitoring with manual refresh

### Targets
- Set target allocation percentages per category
- Visual current vs target comparison chart

### Sharing & Reporting
- **PDF reports** — Generate comprehensive portfolio reports with period filters
- **Share as image** — Theme-aware portfolio snapshot card for sharing
- **Performance metrics** — Sortino ratio, Sharpe ratio, return calculations

### Customization
- **3 themes** — Light, Dark, and Midnight
- **8 accent colors** — Blue, Green, Purple, Red, Orange, Teal, Pink, Indigo (plus custom color picker)
- **12 base currencies** — USD, EUR, GBP, JPY, CHF, CAD, AUD, TRY, CNY, INR, BRL, KRW
- **Custom categories** — Define your own asset categories beyond the defaults
- **Auto-backup** — Scheduled backups with custom folder (hourly, daily, or weekly)

## Download

| Platform | |
|----------|-|
| **Mac** (Intel + Apple Silicon) | [Portfolio-Tracker-Mac.dmg](https://github.com/mertdemiir/portfolio-tracker/releases/latest) |
| **Windows** | [Portfolio-Tracker-Windows.exe](https://github.com/mertdemiir/portfolio-tracker/releases/latest) |

> **Mac users:** Right-click the app and select "Open" the first time.

## Getting Started

1. Download and install the app
2. On first launch, enter a free [Finnhub API key](https://finnhub.io/register) for live stock/ETF prices (optional — crypto prices work without it)
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

React 19, TypeScript, Tailwind CSS 4, Vite 7, Electron 40, Recharts 3

## License

MIT
