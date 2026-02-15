# OMNI Crypto Payments — Zcash Price Converter

## Project Overview

A **Chrome browser extension** that detects product prices on any online store and converts them to their equivalent value in **Zcash (ZEC)** cryptocurrency in real-time.

## What It Does

- **Scans any webpage** for product prices displayed in fiat currency (USD, EUR, GBP, etc.)
- **Converts prices to Zcash (ZEC)** using live exchange rates (e.g., if $1 USD = 0.0034 ZEC, a $100 product shows ≈ 0.34 ZEC)
- **Displays the ZEC equivalent** inline next to the original price, or via a tooltip/overlay
- Works across **all online stores** — Amazon, eBay, Shopify stores, WooCommerce, etc.

## Core Features

- [ ] Chrome extension manifest and popup UI
- [ ] Content script to detect and parse prices on any webpage
- [ ] Live Zcash (ZEC) exchange rate fetching from a crypto price API
- [ ] Real-time fiat → ZEC conversion and display
- [ ] Support for multiple fiat currencies (USD, EUR, GBP, etc.)
- [ ] Settings page for user preferences (default fiat currency, display format, etc.)
- [ ] Clean, non-intrusive price overlay/badge next to detected prices

## Tech Stack

- **Platform:** Chrome Extension (Manifest V3)
- **Languages:** HTML, CSS, JavaScript
- **APIs:** Crypto price API (e.g., CoinGecko, CoinMarketCap, or similar) for live ZEC rates
- **Crypto:** Zcash (ZEC)

## How It Works (High Level)

1. User browses any online store in Chrome
2. The content script scans the page DOM for price patterns (e.g., `$29.99`, `€49.00`)
3. The extension fetches the current ZEC exchange rate from a crypto API
4. Each detected price is converted to ZEC and displayed alongside the original price
5. Prices update automatically when the exchange rate changes or the user navigates to a new page
