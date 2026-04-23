<p align="center">
  <img src="public/logo.png" width="120" alt="Portfolio Tracker" />
</p>

<h1 align="center">Portfolio Tracker</h1>

<p align="center">
  <em>Your entire net worth, on your own machine.</em>
</p>

<p align="center">
  <a href="https://github.com/mertdemiir/portfolio-tracker/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/mertdemiir/portfolio-tracker?style=flat-square&color=10b981" /></a>
  <a href="https://github.com/mertdemiir/portfolio-tracker/actions/workflows/build.yml"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/mertdemiir/portfolio-tracker/build.yml?style=flat-square" /></a>
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
</p>

<p align="center">
  <a href="https://github.com/mertdemiir/portfolio-tracker/releases/latest">
    <b>↓ Download for Mac & Windows</b>
  </a>
</p>

---

## What it tracks

Stocks, ETFs, crypto, cash, gold & silver, real estate, vehicles, custom assets, and liabilities — in 12 base currencies, across multiple portfolios.

## Why you might like it

- **Local-first.** No account, no cloud, no telemetry. Your data lives in a single file you control. Export it, back it up, move it.
- **Actually multi-currency.** Every purchase captures the FX rate at that moment, so your cost basis stays right even as rates drift.
- **Live prices** from Finnhub (stocks/ETFs), CoinGecko (crypto), Swissquote (gold/silver), Frankfurter (FX). Manual prices for everything else.
- **Built for people who care about the math** — realized & unrealized P&L, CAGR, drawdown, rolling returns, Sortino/Sharpe, Monte Carlo for retirement.

## Features

**Core** — Multi-asset net worth · Live prices w/ 5-min auto-refresh · Liabilities · Multiple portfolios · Transactions with undo · CSV import/export

**Charts** — Net worth timeline · Drawdown · Rolling returns · Allocation pie · Category breakdown · Currency exposure · Treemap · Benchmark overlays (S&P 500, BTC, Gold) · Allocation vs targets

**Planning** — FIRE calculator with Lean/Regular/Fat/Coast variants · Monte Carlo withdrawal simulation · Price-shock simulator · Rebalance planner · Milestones

**Extras** — Timeline annotations · PDF reports · Shareable snapshot images · Watchlist · 5 themes · 8 accent colors + custom picker · Auto-backup to a folder you choose

## Your data is safe

Data lives in `localStorage` on your machine. In addition:

- **Manual export anywhere** — ⌘⇧E / Ctrl+Shift+E drops a JSON file wherever you want
- **Auto-backup** on a schedule to a folder of your choice
- **Pre-migration backups** run automatically before any data upgrade
- **Error recovery screen** — if anything ever crashes, you get a one-click export before anything else

## Download

| | |
|--|--|
| **macOS** (Apple Silicon + Intel) | [Portfolio-Tracker-Mac.dmg](https://github.com/mertdemiir/portfolio-tracker/releases/latest) |
| **Windows** | [Portfolio-Tracker-Windows.exe](https://github.com/mertdemiir/portfolio-tracker/releases/latest) |

> **Mac:** right-click the app and choose **Open** the first time.
>
> Grab a free [Finnhub API key](https://finnhub.io/register) for live stock & ETF prices (optional — crypto works without one).

## Develop

```sh
npm install
npm run dev               # run in the browser
npm run electron:dev      # run as a desktop app
npm run test              # vitest suite
npm run electron:build    # produce the DMG / exe
```

## Stack

React 19 · TypeScript · Tailwind 4 · Vite 7 · Electron 40 · Recharts · Vitest

## License

MIT
