# Onbalansmarkt Zonneplan Battery Homey App

Homey app for delivering Zonneplan battery trading results to onbalansmarkt.com.

## Overview

This Homey app enables Zonneplan battery users to send their trading results to [onbalansmarkt.com](https://onbalansmarkt.com), allowing you to track your trading performance and rankings on the imbalance market.

### Supported Devices

- **Zonneplan Battery** - Flow-card driven integration for battery metrics

## Features

- **Flow Card Integration**: Receive battery metrics via Homey flow cards from your Zonneplan battery app
- **Onbalansmarkt Integration**: Send measurements directly to onbalansmarkt.com with an optional API key
- **Scheduled Measurements**: Automatically send measurements at configurable intervals (e.g., every 15 minutes)
- **Automatic Sending**: Auto-send battery data when received via flow card (or scheduled)
- **Zero-Result Filtering**: Optional setting to skip sending when daily earnings are zero
- **Profile Polling**: Automatic polling of user rankings (overall and provider rank)
- **Trading Mode**: Manual selection of trading mode (Imbalance, Imbalance Aggressive, Self Consumption Plus, Manual)
- **Battery Metrics**: Track daily earnings, lifetime total, charge/discharge values, battery cycles, and load balancing status
- **Countdown Timer**: Visual indicator showing minutes until next scheduled measurement send

## Requirements

- **Homey Device** running Homey OS >= 12.4.0 (local platform only)
- **Zonneplan Battery App** - For receiving battery metrics
- **Onbalansmarkt API Key** - Optional, for sending measurements to onbalansmarkt.com

## Installation

1. Open Homey App Store
2. Search for "Onbalansmarkt Zonneplan Battery"
3. Tap "Install"
4. Follow the pairing wizard to add your Zonneplan battery device

## Configuration

### Device Setup

When adding the Zonneplan Battery device:

1. **Enter Device Name**: Give your battery a recognizable name
2. **Select Trading Mode**: Choose your trading mode for Onbalansmarkt
3. **API Key (Optional)**: Enter your Onbalansmarkt API key if you want to automatically send measurements

### Device Settings

- **Device Name**: Display name for the battery device
- **Trading Mode**: Trading mode selection (manual, imbalance, imbalance_aggressive, self_consumption_plus)
- **Total Earned Offset**: Manual offset to correct lifetime total (in €)
- **API Key**: Onbalansmarkt.com API key (optional)
- **Poll Interval**: Interval for polling user profile/rankings from Onbalansmarkt (default: 5 minutes)
- **Auto-send Measurements**: Enable to automatically send data to Onbalansmarkt when received via flow card
- **Scheduled Send Enabled**: Enable automatic scheduled measurements sending
- **Scheduled Send Interval**: Interval for scheduled measurements (default: 15 minutes)
- **Scheduled Send Start Minute**: Start minute of the hour for scheduled sends (default: 0)
- **Report Zero Trading Results**: Enable to send measurements even when daily earnings are zero
- **Exclude from Energy**: Exclude device from Homey Energy dashboard

## Flow Cards

### Actions

- **Receive Zonneplan Metrics** - Receive battery metrics from your Zonneplan battery and optionally send to Onbalansmarkt

### Triggers

- **Zonneplan Metrics Updated** - Triggers when new metrics are received

## Capabilities

The app provides the following custom capabilities:

### Battery Metrics (from Flow Card)
- `zonneplan_daily_earned` - Daily battery earnings (€)
- `zonneplan_total_earned` - Lifetime earnings with optional offset (€)
- `zonneplan_daily_charged` - Daily energy charged (kWh)
- `zonneplan_daily_discharged` - Daily energy discharged (kWh)
- `zonneplan_cycle_count` - Battery charge/discharge cycles
- `zonneplan_load_balancing` - Dynamic load balancing status (boolean)
- `zonneplan_last_update` - Timestamp of last data receipt
- `measure_battery` - Battery percentage (standard capability)

### API-Reported Metrics (from Onbalansmarkt)
- `zonneplan_reported_charged` - Daily charged according to Onbalansmarkt API (kWh)
- `zonneplan_reported_discharged` - Daily discharged according to Onbalansmarkt API (kWh)

### User Rankings
- `zonneplan_overall_rank` - User's overall ranking position
- `zonneplan_provider_rank` - User's provider ranking position

### Scheduling
- `onbalansmarkt_next_livesend` - Countdown to next scheduled measurement send (minutes)

## How to Use

1. **Install the Zonneplan Battery app** from the Homey App Store
2. **Add Zonneplan Battery device** to this app with your desired trading mode and API key
3. **Create a Homey Flow** to send battery metrics from Zonneplan to this app:
   - Trigger: When Zonneplan battery metrics update
   - Action: "Receive Zonneplan Metrics" → Select device → Map the values
4. **Configure Sending Method** (choose one or both):
   - **Auto-send on Flow**: Enable "Auto-send Measurements" to send data immediately when received
   - **Scheduled Sending**: Enable "Scheduled Send Enabled" and configure interval/start time for regular automated sends
5. **Optional**: Check the "Onbalansmarkt next Livesend" capability to see countdown to next scheduled send
6. **Optional**: Enable "Report Zero Trading Results" if you want to send measurements even on zero-earning days

## Support

For issues, feature requests, or bug reports, please visit:
[GitHub Issues](https://github.com/hhi/org.hhi.onbalansmarkt-zonneplan/issues)

## License

See repository for license information.

## Privacy

This app respects your privacy:
- Battery data is only sent to onbalansmarkt.com if explicitly enabled
- No telemetry or tracking
- All data processing is local to your Homey device
