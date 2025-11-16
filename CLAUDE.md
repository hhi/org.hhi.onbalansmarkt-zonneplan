# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

This is a **Homey App** for Zonneplan battery users to send trading results to onbalansmarkt.com. Unlike the Frank Energie app, this uses a **flow-card driven approach** (passive pattern) instead of API polling.

- **Homey SDK**: Version 3 (SDK3)
- **Compatibility**: Homey OS >= 12.4.0
- **Platforms**: Local only
- **Language**: TypeScript
- **App ID**: org.hhi.onbalansmarkt-zonneplan

## Architecture Overview

### High-Level Structure

The app follows Homey's standard architecture with three main layers:

1. **App Layer** (`app.ts`): Main application entry point
2. **Driver Layer** (`drivers/zonneplan-battery/driver.ts`): Single Zonneplan battery driver with manual pairing
3. **Library Layer** (`lib/`): OnbalansmarktClient for API communication

### Key Difference from Frank Energie

**Frank Energie Pattern:**
- Active API polling at scheduled intervals
- Automatic device discovery
- Multiple drivers (battery, meter, EV, PV)
- Complex credential management

**Zonneplan Pattern:**
- **Passive flow-card driven** (receives data via Homey flows)
- Virtual device with manual pairing
- Single driver (zonneplan-battery)
- No Frank Energie authentication
- Optional API integration for rankings via Onbalansmarkt profile polling

### Library Services

The app uses one reusable service:

#### OnbalansmarktClient (`lib/onbalansmarkt-client.ts`)

REST API client for Onbalansmarkt.com:

- **Send Measurements**: Post battery trading results
- **Get Profile**: Retrieve user profile with ranking information
- **Error Handling**: Comprehensive error management

```typescript
import { OnbalansmarktClient } from '../lib';

const client = new OnbalansmarktClient({
  apiKey: 'your-api-key',
  logger: (msg, ...args) => this.log(msg, ...args),
});

// Send measurements
await client.sendMeasurement({
  timestamp: new Date(),
  batteryResult: 0.61,
  batteryResultTotal: 293.94,
  batteryCharge: 76,
  mode: 'imbalance',
});
```

### Driver Architecture

**Virtual Device Pattern:**
- No credential verification (manual user configuration)
- Simple pairing flow: Device name → Trading mode → API key (optional)
- Settings stored per device instance
- Single device per Zonneplan battery

## Development Commands

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `.homeybuild/` directory.

### Validate

```bash
homey app validate
```

Validates the Homey app structure and configuration.

### Lint

```bash
npm run lint
```

Runs ESLint on `.js` and `.ts` files.

## Key Concepts

- **Capabilities**: Custom capabilities for battery metrics and Onbalansmarkt integration

  **Flow Card Metrics:**
  - `zonneplan_daily_earned` - Daily earnings (€)
  - `zonneplan_total_earned` - Lifetime total (€)
  - `zonneplan_daily_charged` - Daily charged (kWh)
  - `zonneplan_daily_discharged` - Daily discharged (kWh)
  - `zonneplan_cycle_count` - Battery cycles
  - `zonneplan_load_balancing` - Load balancing status
  - `zonneplan_last_update` - Last update timestamp

  **API-Reported Metrics:**
  - `zonneplan_reported_charged` - Daily charged from API (kWh)
  - `zonneplan_reported_discharged` - Daily discharged from API (kWh)

  **Ranking & Scheduling:**
  - `zonneplan_overall_rank` - User's overall rank
  - `zonneplan_provider_rank` - User's provider rank
  - `onbalansmarkt_next_livesend` - Countdown timer to next scheduled send (minutes)

- **Flow Cards**:
  - **Action**: `receive_zonneplan_metrics` - Receive metrics from Zonneplan
  - **Trigger**: `zonneplan_metrics_updated` - Fires when metrics received

- **Scheduled Measurements**:
  - Automatic sending of measurements at configured intervals
  - Configurable start minute and interval (e.g., every 15 minutes starting at minute 0)
  - Optional zero-result filtering to avoid reporting zero earnings
  - Countdown timer displays minutes until next scheduled send

- **Configuration**:
  - `.homeycompose/app.json` - App metadata
  - `drivers/zonneplan-battery/driver.compose.json` - Driver configuration
  - `drivers/zonneplan-battery/driver.settings.compose.json` - Device settings

## Best Practices

### Homey-Specific

- **ALWAYS** use `this.homey.setTimeout()` instead of global `setTimeout()`
- **ALWAYS** use `this.homey.setInterval()` instead of global `setInterval()`
- **NEVER** use `console.log()` - use Homey's logging via `this.log()`
- **NEVER** use `as any` - use `@ts-expect-error` with explanatory comment instead

### TypeScript/Code Quality

- Use strict type checking
- Follow ESLint rules (athom config)
- Use template literals for multi-line strings
- Use `const` by default, only `let` when reassignment needed

### Logging

All services should accept optional logger:

```typescript
export interface ServiceConfig {
  logger?: (message: string, ...args: unknown[]) => void;
}

// Usage
this.logger?.('Message here', { detail: 'value' });
```

## Configuration Files

### `.homeycompose/` Structure

```
.homeycompose/
├── app.json                           # App metadata
├── capabilities/                      # Custom capability definitions (12 total)
│   ├── zonneplan_daily_earned.json
│   ├── zonneplan_total_earned.json
│   ├── zonneplan_daily_charged.json
│   ├── zonneplan_daily_discharged.json
│   ├── zonneplan_cycle_count.json
│   ├── zonneplan_load_balancing.json
│   ├── zonneplan_last_update.json
│   ├── zonneplan_overall_rank.json
│   ├── zonneplan_provider_rank.json
│   ├── zonneplan_reported_charged.json
│   ├── zonneplan_reported_discharged.json
│   └── onbalansmarkt_next_livesend.json
└── flow/
    ├── actions/
    │   └── receive_zonneplan_metrics.json
    └── triggers/
        └── zonneplan_metrics_updated.json
```

### Important Notes

- **app.json**: Auto-generated from `.homeycompose/app.json` - never edit manually
- **driver.settings.compose.json**: User-configurable settings per device
- **Locales**: Translations in `locales/en.json` and `locales/nl.json`

## Important Files

| File | Purpose |
|------|---------|
| `app.ts` | Main app class, entry point |
| `drivers/zonneplan-battery/driver.ts` | Driver for device pairing |
| `drivers/zonneplan-battery/device.ts` | Device logic and capabilities |
| `lib/onbalansmarkt-client.ts` | Onbalansmarkt API client |
| `.homeycompose/app.json` | App configuration source |
| `app.json` | **Auto-generated** - do not edit |
| `package.json` | Dependencies and scripts |

## Testing & Validation

Build and validate before committing:

```bash
npm run build
homey app validate
```

## Deployment

The `.homeybuild/` directory contains compiled JavaScript ready for deployment.

## Official References

- [Homey Apps SDK v3](https://apps-sdk-v3.developer.homey.app/)
- [Homey Apps Developer Site](https://apps.developer.homey.app)
- [Homey Compose](https://apps.developer.homey.app/advanced/homey-compose)
