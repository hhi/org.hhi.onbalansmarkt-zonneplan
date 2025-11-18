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
- **Test/Simulation Mode**: Test the live measurement flow without sending data to Onbalansmarkt (uses test data if real metrics unavailable)

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

**Device Configuration:**
- **Device Name**: Display name for the battery device
- **Trading Mode**: Trading mode selection (manual, imbalance, imbalance_aggressive, self_consumption_plus)
- **Total Earned Offset (€)**: Manual offset to correct lifetime total earnings (in €)

**Onbalansmarkt Integration:**
- **API Key**: Onbalansmarkt.com API key (optional, required for sending data)
- **Poll Interval (seconds)**: Interval for polling user profile/rankings from Onbalansmarkt (default: 300s = 5 minutes)
- **Enable Scheduled Measurements**: Enable automatic scheduled measurements sending at configured intervals
- **Send Interval (minutes)**: Interval for scheduled measurements (default: 15 minutes, range: 5-1440)
- **Start Minute (0-59)**: Start minute of the hour for scheduled sends (default: 0, e.g., minute 0 = :00 past each hour)

**Advanced:**
- **Report Zero Trading Results**: Enable to send measurements even when daily earnings are €0 (default: disabled)

**Energy Dashboard:**
- **Exclude from Energy**: Exclude device from Homey Energy dashboard (default: enabled)

**Testing & Debug:**
- **🧪 Test Live Measurement (Simulation)**: Toggle ON to run a test simulation of live measurement sending. No data sent to Onbalansmarkt. Uses real metrics if available, otherwise generates test data. Automatically turns OFF after test completes.

## Flow Cards

### Actions

- **Receive Zonneplan Metrics** - Receive battery metrics from your Zonneplan battery and optionally send to Onbalansmarkt (based on device settings)
- **Send Live Measurement** - Manually send the last received metrics to Onbalansmarkt (requires previously received metrics)

### Triggers

- **Zonneplan Metrics Updated** - Triggers when new metrics are received (provides all metric tokens for flow conditions and downstream actions)

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

### Basic Setup

1. **Install the Zonneplan Battery app** from the Homey App Store
2. **Add Zonneplan Battery device** to this app with your desired trading mode and API key (optional)
3. **Create a Homey Flow** to send battery metrics from Zonneplan to this app:
   - Trigger: When Zonneplan battery metrics update
   - Action: "Receive Zonneplan Metrics" → Select device → Map the values

### Sending Data to Onbalansmarkt

Configure one or both sending methods:

- **Auto-send on Flow**: Metrics are sent immediately when received via the flow card
  - Enable in device settings: Device Settings → Onbalansmarkt Integration → Check "measurements_send_enabled"
  - **Note**: Requires API key to be configured

- **Scheduled Sending**: Metrics are sent automatically at regular intervals (e.g., every 15 minutes)
  - Enable in device settings: Device Settings → Onbalansmarkt Integration → Check "measurements_send_enabled"
  - Configure interval and start minute in related settings
  - **Note**: Requires API key and previously received metrics

### Optional Features

- **Zero-Result Filtering**: Enable "Report Zero Trading Results" setting if you want to send measurements even on zero-earning days (default: disabled)
- **Countdown Timer**: Check the "Onbalansmarkt next Livesend" capability to see minutes until next scheduled send
- **Manual Sending**: Use the "Send Live Measurement" action card to manually send the last received metrics

### Testing (Simulation Mode)

Test the measurement flow without sending data to Onbalansmarkt:

1. **First time testing**: Toggle the "🧪 Test Live Measurement (Simulation)" setting ON
   - If no metrics have been received yet, the app automatically generates test data
   - Simulation output appears in Homey's app logs

2. **After receiving real metrics**: Toggle the setting ON again
   - Uses the actual metrics you've received
   - Helpful for verifying data before enabling live sending

The setting automatically turns OFF after the test completes.

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
