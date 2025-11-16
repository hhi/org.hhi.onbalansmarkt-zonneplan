# Onbalansmarkt Zonneplan Battery Homey App

Homey app for delivering Zonneplan battery trading results to onbalansmarkt.com.

## Overview

This Homey app enables Zonneplan battery users to send their trading results to [onbalansmarkt.com](https://onbalansmarkt.com), allowing you to track your trading performance and rankings on the imbalance market.

### Supported Devices

- **Zonneplan Battery** - Flow-card driven integration for battery metrics

## Features

- **Flow Card Integration**: Receive battery metrics via Homey flow cards from your Zonneplan battery app
- **Onbalansmarkt Integration**: Send measurements directly to onbalansmarkt.com with an optional API key
- **Automatic Sending**: Auto-send battery data when received via flow card
- **Trading Mode**: Manual selection of trading mode (Imbalance, Imbalance Aggressive, Self Consumption Plus, Manual)
- **Battery Metrics**: Track daily earnings, lifetime total, charge/discharge values, battery cycles, and load balancing status

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
- **Auto-send Measurements**: Enable to automatically send data to Onbalansmarkt when received
- **Exclude from Energy**: Exclude device from Homey Energy dashboard

## Flow Cards

### Actions

- **Receive Zonneplan Metrics** - Receive battery metrics from your Zonneplan battery and optionally send to Onbalansmarkt

### Triggers

- **Zonneplan Metrics Updated** - Triggers when new metrics are received

## Capabilities

The app provides the following custom capabilities:

- `zonneplan_daily_earned` - Daily battery earnings (€)
- `zonneplan_total_earned` - Lifetime earnings with optional offset (€)
- `zonneplan_daily_charged` - Daily energy charged (kWh)
- `zonneplan_daily_discharged` - Daily energy discharged (kWh)
- `zonneplan_cycle_count` - Battery charge/discharge cycles
- `zonneplan_load_balancing` - Dynamic load balancing status (boolean)
- `zonneplan_last_update` - Timestamp of last data receipt
- `measure_battery` - Battery percentage (standard capability)

## How to Use

1. **Install the Zonneplan Battery app** from the Homey App Store
2. **Add Zonneplan Battery device** to this app with your desired trading mode
3. **Create a Homey Flow** to send battery metrics from Zonneplan to this app:
   - Trigger: When Zonneplan battery metrics update
   - Action: "Receive Zonneplan Metrics" → Select device → Map the values
4. **Optional**: Enable "Auto-send Measurements" to automatically report to Onbalansmarkt

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
