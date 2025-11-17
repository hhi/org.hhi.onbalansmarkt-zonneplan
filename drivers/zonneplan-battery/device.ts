import Homey from 'homey';
import { OnbalansmarktClient } from '../../lib';

interface ZonneplanMetrics {
  dailyEarned: number;
  totalEarned: number;
  dailyCharged: number;
  dailyDischarged: number;
  batteryPercentage: number;
  cycleCount: number;
  loadBalancingActive: boolean;
  timestamp: Date;
}

/**
 * Zonneplan Battery Device
 *
 * Virtual device that receives battery data via Homey flow cards
 * and optionally sends it to Onbalansmarkt.com.
 */
export = class ZonneplanBatteryDevice extends Homey.Device {
  private onbalansmarktClient: OnbalansmarktClient | null = null;
  private profilePollerHandle: NodeJS.Timeout | null = null;
  private measurementsSchedulerHandle: NodeJS.Timeout | null = null;
  private countdownTimerHandle: NodeJS.Timeout | null = null;
  private lastReceivedMetrics: ZonneplanMetrics | null = null;

  async onInit() {
    this.log('ZonneplanBatteryDevice initialized');

    // Initialize Onbalansmarkt client if API key is configured
    this.initializeOnbalansmarktClient();

    // Register flow card action handler
    this.registerFlowCardHandler();

    // Initialize capabilities with default values if not set
    await this.initializeCapabilities();

    // Restore last received metrics from persistent storage
    await this.restoreLastReceivedMetrics();

    // Start profile poller if API key is configured
    this.startProfilePoller();

    // Start measurements scheduler if enabled
    this.startMeasurementsScheduler();

    this.log('Zonneplan Battery device ready');
  }

  /**
   * Initialize Onbalansmarkt client if API key is configured
   */
  private initializeOnbalansmarktClient() {
    const apiKey = this.getSetting('onbalansmarkt_api_key');
    if (apiKey && apiKey.trim().length > 0) {
      this.onbalansmarktClient = new OnbalansmarktClient({
        apiKey: apiKey.trim(),
        logger: (msg, ...args) => this.log(msg, ...args),
      });
      this.log('Onbalansmarkt client initialized');
    } else {
      this.onbalansmarktClient = null;
      this.log('No Onbalansmarkt API key configured - integration disabled');
    }
  }

  /**
   * Start polling for Onbalansmarkt profile data (rankings)
   */
  private startProfilePoller() {
    // Stop existing poller if any
    this.stopProfilePoller();

    // Only start if API key is configured
    if (!this.onbalansmarktClient) {
      this.log('Onbalansmarkt client not available - profile polling disabled');
      return;
    }

    // Get poll interval setting (default 300 seconds = 5 minutes)
    const pollInterval = (this.getSetting('onbalansmarkt_poll_interval') || 300) * 1000;

    // Fetch immediately on startup
    this.fetchAndUpdateProfile();

    // Then set up periodic polling
    this.profilePollerHandle = this.homey.setInterval(async () => {
      await this.fetchAndUpdateProfile();
    }, pollInterval);

    this.log(`Profile poller started with ${pollInterval / 1000}s interval`);
  }

  /**
   * Stop profile poller
   */
  private stopProfilePoller() {
    if (this.profilePollerHandle) {
      this.homey.clearInterval(this.profilePollerHandle);
      this.profilePollerHandle = null;
      this.log('Profile poller stopped');
    }
  }

  /**
   * Start scheduled measurement sender
   */
  private startMeasurementsScheduler() {
    // Stop existing scheduler if any
    this.stopMeasurementsScheduler();

    // Only start if enabled and API key is configured
    const enabled = this.getSetting('measurements_send_enabled');
    if (!enabled || !this.onbalansmarktClient) {
      this.log('Measurements scheduler disabled or no API key configured');
      return;
    }

    // Calculate time to first send
    const timeToFirstSend = this.calculateNextMeasurementTime();
    const intervalMinutes = (this.getSetting('measurements_send_interval') || 15) as number;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.log(`Measurements scheduler will first run in ${timeToFirstSend}ms, then every ${intervalMinutes} minutes`);

    // Start countdown timer
    this.startCountdownTimer();

    // Schedule first run
    const firstRunHandle = this.homey.setTimeout(async () => {
      await this.sendScheduledMeasurement();

      // Then set up periodic interval
      this.measurementsSchedulerHandle = this.homey.setInterval(async () => {
        await this.sendScheduledMeasurement();
      }, intervalMs);

      this.log(`Measurements scheduler started with ${intervalMinutes}m interval`);
    }, timeToFirstSend);

    // Store the timeout handle so we can clear it if needed
    this.measurementsSchedulerHandle = firstRunHandle;
  }

  /**
   * Stop measurement scheduler
   */
  private stopMeasurementsScheduler() {
    if (this.measurementsSchedulerHandle) {
      this.homey.clearInterval(this.measurementsSchedulerHandle);
      this.homey.clearTimeout(this.measurementsSchedulerHandle);
      this.measurementsSchedulerHandle = null;
      this.log('Measurements scheduler stopped');
    }
    // Stop countdown timer
    this.stopCountdownTimer();
  }

  /**
   * Start countdown timer for next scheduled send
   */
  private startCountdownTimer() {
    this.stopCountdownTimer();

    // Update immediately
    this.updateCountdownDisplay();

    // Then update every 10 seconds
    this.countdownTimerHandle = this.homey.setInterval(() => {
      this.updateCountdownDisplay();
    }, 10000); // Update every 10 seconds for smooth countdown

    this.log('Countdown timer started');
  }

  /**
   * Stop countdown timer
   */
  private stopCountdownTimer() {
    if (this.countdownTimerHandle) {
      this.homey.clearInterval(this.countdownTimerHandle);
      this.countdownTimerHandle = null;
      this.log('Countdown timer stopped');
    }
  }

  /**
   * Update countdown display with minutes until next send
   */
  private async updateCountdownDisplay() {
    const now = new Date();
    const startMinute = (this.getSetting('measurements_send_start_minute') || 0) as number;
    const intervalMinutes = (this.getSetting('measurements_send_interval') || 15) as number;

    // Calculate next send time
    const currentMinute = now.getMinutes();
    let nextMinute = startMinute;

    if (currentMinute < startMinute) {
      nextMinute = startMinute;
    } else {
      nextMinute = startMinute;
      while (nextMinute <= currentMinute) {
        nextMinute += intervalMinutes;
      }
    }

    const nextSendTime = new Date(now);
    nextSendTime.setMinutes(nextMinute, 0, 0);

    if (nextSendTime <= now) {
      nextSendTime.setMinutes(nextSendTime.getMinutes() + intervalMinutes);
    }

    // Calculate minutes remaining
    const msRemaining = nextSendTime.getTime() - now.getTime();
    const minutesRemaining = Math.ceil(msRemaining / 60000);

    try {
      await this.setCapabilityValue('onbalansmarkt_next_livesend', Math.max(0, minutesRemaining));
    } catch (error) {
      this.error('Failed to update countdown timer:', error);
    }
  }

  /**
   * Calculate milliseconds until next measurement should be sent
   */
  private calculateNextMeasurementTime(): number {
    const now = new Date();
    const startMinute = (this.getSetting('measurements_send_start_minute') || 0) as number;
    const intervalMinutes = (this.getSetting('measurements_send_interval') || 15) as number;

    // Get current minute of the hour
    const currentMinute = now.getMinutes();

    // Calculate next send time based on start minute and interval
    let nextMinute = startMinute;

    // If we haven't reached start minute this hour yet
    if (currentMinute < startMinute) {
      nextMinute = startMinute;
    } else {
      // Find next occurrence by adding intervals
      nextMinute = startMinute;
      while (nextMinute <= currentMinute) {
        nextMinute += intervalMinutes;
      }
    }

    // Create date for next send
    const nextSendTime = new Date(now);
    nextSendTime.setMinutes(nextMinute, 0, 0); // Set to start of next send minute

    // If next send time is in the past, add one interval
    if (nextSendTime <= now) {
      nextSendTime.setMinutes(nextSendTime.getMinutes() + intervalMinutes);
    }

    const timeToWait = nextSendTime.getTime() - now.getTime();
    this.log(`Next measurement send at ${nextSendTime.toISOString()} (in ${Math.round(timeToWait / 1000)}s)`);

    return timeToWait;
  }

  /**
   * Send scheduled measurement if available
   */
  private async sendScheduledMeasurement() {
    if (!this.lastReceivedMetrics) {
      this.log('No metrics available for scheduled send');
      return;
    }

    // Check if we should skip sending zero results
    const reportZeroResults = this.getSetting('report_zero_trading_results') || false;
    if (this.lastReceivedMetrics.dailyEarned === 0 && !reportZeroResults) {
      this.log('Skipping scheduled send: zero trading result and report_zero_trading_results is disabled');
      return;
    }

    this.log('Sending scheduled measurement');
    await this.sendToOnbalansmarkt(this.lastReceivedMetrics);
  }

  /**
   * Fetch and update profile data from Onbalansmarkt
   */
  private async fetchAndUpdateProfile() {
    if (!this.onbalansmarktClient) {
      return;
    }

    try {
      const profile = await this.onbalansmarktClient.getProfile();

      // Update capabilities with today's data from API
      if (profile.resultToday) {
        // Rankings
        await this.setCapabilityValue('zonneplan_overall_rank', profile.resultToday.overallRank || 0);
        await this.setCapabilityValue('zonneplan_provider_rank', profile.resultToday.providerRank || 0);

        // Reported battery metrics from API (separate from flow card data)
        if (profile.resultToday.batteryCharged !== null && profile.resultToday.batteryCharged !== undefined) {
          await this.setCapabilityValue('zonneplan_reported_charged', profile.resultToday.batteryCharged);
        }
        if (profile.resultToday.batteryDischarged !== null && profile.resultToday.batteryDischarged !== undefined) {
          await this.setCapabilityValue('zonneplan_reported_discharged', profile.resultToday.batteryDischarged);
        }
      } else {
        // No data yet for today
        await this.setCapabilityValue('zonneplan_overall_rank', 0);
        await this.setCapabilityValue('zonneplan_provider_rank', 0);
      }

      this.log('Profile data fetched and updated');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to fetch profile data:', errorMsg);
    }
  }

  /**
   * Initialize capabilities with default values
   * Preserves existing values (persistent across updates)
   */
  private async initializeCapabilities() {
    const capabilities = [
      { name: 'measure_battery', value: 0 },
      { name: 'zonneplan_daily_earned', value: 0 },
      { name: 'zonneplan_total_earned', value: 0 },
      { name: 'zonneplan_daily_charged', value: 0 },
      { name: 'zonneplan_daily_discharged', value: 0 },
      { name: 'zonneplan_reported_charged', value: 0 }, // From API
      { name: 'zonneplan_reported_discharged', value: 0 }, // From API
      { name: 'zonneplan_cycle_count', value: 0 },
      { name: 'zonneplan_load_balancing', value: false },
      { name: 'zonneplan_last_update', value: 'Never' }, // Persistent - only set if capability is new
      { name: 'zonneplan_overall_rank', value: 0 },
      { name: 'zonneplan_provider_rank', value: 0 },
      { name: 'onbalansmarkt_next_livesend', value: 0 }, // Countdown to next scheduled send
    ];

    for (const cap of capabilities) {
      if (!this.hasCapability(cap.name)) {
        try {
          await this.addCapability(cap.name);
          // Only set default value for NEW capabilities
          await this.setCapabilityValue(cap.name, cap.value);
          this.log(`Added capability: ${cap.name} with default value`);
        } catch (error) {
          this.error(`Failed to add capability ${cap.name}:`, error);
        }
      } else {
        // Capability already exists - preserve its current value
        try {
          const currentValue = this.getCapabilityValue(cap.name);
          // Log if we're restoring a value after update
          if (currentValue !== null && currentValue !== undefined) {
            if (cap.name === 'zonneplan_last_update') {
              this.log(`Restored last_update value after update: ${currentValue}`);
            }
          }
        } catch (error) {
          this.error(`Failed to read capability ${cap.name}:`, error);
        }
      }
    }
  }

  /**
   * Register flow card action handlers
   */
  private registerFlowCardHandler() {
    // Handler for receiving metrics from Zonneplan
    const receiveMetricsCard = this.homey.flow.getActionCard('receive_zonneplan_metrics');
    receiveMetricsCard.registerRunListener(async (args) => {
      this.log('Received Zonneplan metrics via flow card');

      const metrics: ZonneplanMetrics = {
        dailyEarned: args.daily_earned || 0,
        totalEarned: args.total_earned || 0,
        dailyCharged: args.daily_charged || 0,
        dailyDischarged: args.daily_discharged || 0,
        batteryPercentage: args.battery_percentage || 0,
        cycleCount: args.cycle_count || 0,
        loadBalancingActive: args.load_balancing_active || false,
        timestamp: args.timestamp ? new Date(args.timestamp) : new Date(),
      };

      await this.handleReceivedMetrics(metrics);
      return true;
    });

    // Handler for sending live measurement
    const sendLiveCard = this.homey.flow.getActionCard('send_live_measurement');
    sendLiveCard.registerRunListener(async (args) => {
      this.log('Send live measurement action triggered');

      if (!this.lastReceivedMetrics) {
        this.log('No metrics available for live send - please receive metrics first');
        throw new Error('No metrics available. Please receive Zonneplan metrics first.');
      }

      await this.sendLiveMeasurement(this.lastReceivedMetrics);
      return true;
    });
  }

  /**
   * Handle received battery metrics
   */
  private async handleReceivedMetrics(metrics: ZonneplanMetrics) {
    this.log('Processing Zonneplan metrics:', JSON.stringify(metrics));

    // Store the latest metrics for scheduled sending
    this.lastReceivedMetrics = metrics;

    // Persist metrics to Store for recovery after app restart
    await this.saveMetricsToStore(metrics);

    // Update all capabilities
    await this.updateCapabilities(metrics);

    // Send to Onbalansmarkt if enabled
    if (this.getSetting('auto_send_measurements')) {
      // Check if we should skip sending zero results
      const reportZeroResults = this.getSetting('report_zero_trading_results') || false;
      if (metrics.dailyEarned === 0 && !reportZeroResults) {
        this.log('Skipping zero trading result - report_zero_trading_results is disabled');
      } else {
        await this.sendToOnbalansmarkt(metrics);
      }
    }

    // Emit trigger card
    await this.emitMetricsUpdatedTrigger(metrics);

    this.log('Metrics processed successfully');
  }

  /**
   * Update device capabilities with received metrics
   */
  private async updateCapabilities(metrics: ZonneplanMetrics) {
    // Apply total earned offset from settings
    const offset = this.getSetting('total_earned_offset') || 0;
    const adjustedTotal = metrics.totalEarned + offset;

    const updates = [
      { name: 'measure_battery', value: metrics.batteryPercentage },
      { name: 'zonneplan_daily_earned', value: metrics.dailyEarned },
      { name: 'zonneplan_total_earned', value: adjustedTotal },
      { name: 'zonneplan_daily_charged', value: metrics.dailyCharged },
      { name: 'zonneplan_daily_discharged', value: metrics.dailyDischarged },
      { name: 'zonneplan_cycle_count', value: metrics.cycleCount },
      { name: 'zonneplan_load_balancing', value: metrics.loadBalancingActive },
      {
        name: 'zonneplan_last_update',
        value: metrics.timestamp.toLocaleString('nl-NL', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ];

    for (const update of updates) {
      try {
        await this.setCapabilityValue(update.name, update.value);
      } catch (error) {
        this.error(`Failed to update capability ${update.name}:`, error);
      }
    }
  }

  /**
   * Send metrics to Onbalansmarkt.com
   */
  private async sendToOnbalansmarkt(metrics: ZonneplanMetrics) {
    if (!this.onbalansmarktClient) {
      this.log('Onbalansmarkt client not initialized - skipping send');
      return;
    }

    try {
      const tradingMode = this.getSetting('trading_mode') || 'manual';
      const offset = this.getSetting('total_earned_offset') || 0;

      await this.onbalansmarktClient.sendMeasurement({
        timestamp: metrics.timestamp,
        batteryResult: metrics.dailyEarned,
        batteryResultTotal: metrics.totalEarned + offset,
        batteryCharge: metrics.batteryPercentage,
        chargedToday: metrics.dailyCharged > 0 ? Math.round(metrics.dailyCharged) : undefined,
        dischargedToday: metrics.dailyDischarged > 0 ? Math.round(metrics.dailyDischarged) : undefined,
        totalBatteryCycles: metrics.cycleCount > 0 ? metrics.cycleCount : undefined,
        loadBalancingActive: metrics.loadBalancingActive ? 'on' : 'off',
        mode: tradingMode as 'imbalance' | 'imbalance_aggressive' | 'self_consumption_plus' | 'manual',
      });

      this.log('Successfully sent metrics to Onbalansmarkt.com');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to send metrics to Onbalansmarkt:', errorMsg);
    }
  }

  /**
   * Send live measurement (simulated for testing)
   * Similar to sendToOnbalansmarkt but with enhanced logging
   */
  private async sendLiveMeasurement(metrics: ZonneplanMetrics) {
    this.log('='.repeat(60));
    this.log('LIVE MEASUREMENT SEND INITIATED');
    this.log('='.repeat(60));

    if (!this.onbalansmarktClient) {
      this.log('ERROR: Onbalansmarkt client not initialized');
      this.log('Please configure an API key in device settings');
      throw new Error('Onbalansmarkt API key not configured');
    }

    try {
      const tradingMode = this.getSetting('trading_mode') || 'manual';
      const offset = this.getSetting('total_earned_offset') || 0;
      const deviceName = this.getName();

      this.log(`Device: ${deviceName}`);
      this.log(`Trading Mode: ${tradingMode}`);
      this.log(`Timestamp: ${metrics.timestamp.toISOString()}`);
      this.log('-'.repeat(60));
      this.log('Metrics being sent:');
      this.log(`  Daily Earned: €${metrics.dailyEarned}`);
      this.log(`  Total Earned: €${metrics.totalEarned + offset} (with offset: ${offset})`);
      this.log(`  Daily Charged: ${metrics.dailyCharged} kWh`);
      this.log(`  Daily Discharged: ${metrics.dailyDischarged} kWh`);
      this.log(`  Battery Charge: ${metrics.batteryPercentage}%`);
      this.log(`  Cycle Count: ${metrics.cycleCount}`);
      this.log(`  Load Balancing: ${metrics.loadBalancingActive ? 'ON' : 'OFF'}`);
      this.log('-'.repeat(60));

      this.log('Sending to Onbalansmarkt.com...');

      await this.onbalansmarktClient.sendMeasurement({
        timestamp: metrics.timestamp,
        batteryResult: metrics.dailyEarned,
        batteryResultTotal: metrics.totalEarned + offset,
        batteryCharge: metrics.batteryPercentage,
        chargedToday: metrics.dailyCharged > 0 ? Math.round(metrics.dailyCharged) : undefined,
        dischargedToday: metrics.dailyDischarged > 0 ? Math.round(metrics.dailyDischarged) : undefined,
        totalBatteryCycles: metrics.cycleCount > 0 ? metrics.cycleCount : undefined,
        loadBalancingActive: metrics.loadBalancingActive ? 'on' : 'off',
        mode: tradingMode as 'imbalance' | 'imbalance_aggressive' | 'self_consumption_plus' | 'manual',
      });

      this.log('✓ Successfully sent live measurement to Onbalansmarkt.com');
      this.log('='.repeat(60));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('✗ Failed to send live measurement:', errorMsg);
      this.log('='.repeat(60));
      throw error;
    }
  }

  /**
   * Simulate live measurement (TEST MODE - no actual API call)
   * Same logging as sendLiveMeasurement but without sending to Onbalansmarkt
   */
  private async simulateLiveMeasurement(metrics: ZonneplanMetrics): Promise<void> {
    this.log('═'.repeat(60));
    this.log('🧪 SIMULATED LIVE MEASUREMENT TEST');
    this.log('═'.repeat(60));
    this.log('NOTE: This is a TEST SIMULATION - no data sent to Onbalansmarkt.com');
    this.log('═'.repeat(60));

    try {
      const tradingMode = this.getSetting('trading_mode') || 'manual';
      const offset = this.getSetting('total_earned_offset') || 0;
      const deviceName = this.getName();

      this.log(`Device: ${deviceName}`);
      this.log(`Trading Mode: ${tradingMode}`);
      this.log(`Timestamp: ${metrics.timestamp.toISOString()}`);
      this.log('-'.repeat(60));
      this.log('Metrics that WOULD be sent:');
      this.log(`  Daily Earned: €${metrics.dailyEarned}`);
      this.log(`  Total Earned: €${metrics.totalEarned + offset} (with offset: ${offset})`);
      this.log(`  Daily Charged: ${metrics.dailyCharged} kWh`);
      this.log(`  Daily Discharged: ${metrics.dailyDischarged} kWh`);
      this.log(`  Battery Charge: ${metrics.batteryPercentage}%`);
      this.log(`  Cycle Count: ${metrics.cycleCount}`);
      this.log(`  Load Balancing: ${metrics.loadBalancingActive ? 'ON' : 'OFF'}`);
      this.log('-'.repeat(60));

      this.log('✓ Simulation completed successfully');
      this.log('✓ In production, this data WOULD be sent to Onbalansmarkt.com');
      this.log('═'.repeat(60));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('✗ Simulation test failed:', errorMsg);
      this.log('═'.repeat(60));
      throw error;
    }
  }

  /**
   * Emit trigger card when metrics are updated
   */
  private async emitMetricsUpdatedTrigger(metrics: ZonneplanMetrics) {
    try {
      const offset = this.getSetting('total_earned_offset') || 0;
      const triggerCard = this.homey.flow.getDeviceTriggerCard('zonneplan_metrics_updated');

      await triggerCard.trigger(this, {
        daily_earned: metrics.dailyEarned,
        total_earned: metrics.totalEarned + offset,
        daily_charged: metrics.dailyCharged,
        daily_discharged: metrics.dailyDischarged,
        battery_percentage: metrics.batteryPercentage,
        cycle_count: metrics.cycleCount,
        load_balancing_active: metrics.loadBalancingActive,
      });

      this.log('Metrics updated trigger emitted');
    } catch (error) {
      this.error('Failed to emit trigger card:', error);
    }
  }

  /**
   * Handle settings updates
   */
  async onSettings({ newSettings, changedKeys }: {
    newSettings: { [key: string]: unknown };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('Settings updated:', changedKeys);

    // Handle trigger live send checkbox (simulation test mode)
    if (changedKeys.includes('trigger_live_send') && newSettings.trigger_live_send === true) {
      this.log('Live send simulation test triggered via settings');
      if (!this.lastReceivedMetrics) {
        const errorMsg = 'No metrics available for simulation - please receive metrics first';
        this.log('ERROR:', errorMsg);
        // Turn off the setting since we can't simulate
        await this.setSettings({ trigger_live_send: false });
        throw new Error(errorMsg);
      }

      try {
        await this.simulateLiveMeasurement(this.lastReceivedMetrics);
        // Turn off the setting after successful simulation
        await this.setSettings({ trigger_live_send: false });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to run simulation test';
        this.log('ERROR during simulation:', errorMsg);
        // Turn off the setting on error too
        await this.setSettings({ trigger_live_send: false });
        throw error;
      }
    }

    // Reinitialize Onbalansmarkt client if API key changed
    if (changedKeys.includes('onbalansmarkt_api_key')) {
      this.initializeOnbalansmarktClient();
      this.startProfilePoller();
      this.startMeasurementsScheduler();
    }

    // Restart profile poller if poll interval changed
    if (changedKeys.includes('onbalansmarkt_poll_interval')) {
      this.log('Poll interval changed to:', newSettings.onbalansmarkt_poll_interval);
      this.startProfilePoller();
    }

    // Restart measurements scheduler if related settings changed
    if (
      changedKeys.includes('measurements_send_enabled')
      || changedKeys.includes('measurements_send_interval')
      || changedKeys.includes('measurements_send_start_minute')
    ) {
      this.log('Measurements scheduler settings changed');
      this.startMeasurementsScheduler();
    }

    // Log trading mode change
    if (changedKeys.includes('trading_mode')) {
      this.log('Trading mode changed to:', newSettings.trading_mode);
    }

    // Log offset change
    if (changedKeys.includes('total_earned_offset')) {
      this.log('Total earned offset changed to:', newSettings.total_earned_offset);
    }
  }

  /**
   * Save metrics to persistent Store for recovery after restart
   */
  private async saveMetricsToStore(metrics: ZonneplanMetrics): Promise<void> {
    try {
      await this.setStoreValue('lastReceivedMetrics', {
        dailyEarned: metrics.dailyEarned,
        totalEarned: metrics.totalEarned,
        dailyCharged: metrics.dailyCharged,
        dailyDischarged: metrics.dailyDischarged,
        batteryPercentage: metrics.batteryPercentage,
        cycleCount: metrics.cycleCount,
        loadBalancingActive: metrics.loadBalancingActive,
        timestamp: metrics.timestamp.toISOString(),
      });
    } catch (error) {
      this.error('Failed to save metrics to Store:', error);
    }
  }

  /**
   * Restore last received metrics from persistent Store
   * Called during onInit() to restore state after app restart
   */
  private async restoreLastReceivedMetrics(): Promise<void> {
    try {
      // Try to restore from Store first
      const stored = this.getStoreValue('lastReceivedMetrics');

      if (stored && typeof stored === 'object') {
        const storedMetrics = stored as {
          dailyEarned?: number;
          totalEarned?: number;
          dailyCharged?: number;
          dailyDischarged?: number;
          batteryPercentage?: number;
          cycleCount?: number;
          loadBalancingActive?: boolean;
          timestamp?: string;
        };

        this.lastReceivedMetrics = {
          dailyEarned: storedMetrics.dailyEarned || 0,
          totalEarned: storedMetrics.totalEarned || 0,
          dailyCharged: storedMetrics.dailyCharged || 0,
          dailyDischarged: storedMetrics.dailyDischarged || 0,
          batteryPercentage: storedMetrics.batteryPercentage || 0,
          cycleCount: storedMetrics.cycleCount || 0,
          loadBalancingActive: storedMetrics.loadBalancingActive || false,
          timestamp: storedMetrics.timestamp ? new Date(storedMetrics.timestamp) : new Date(),
        };

        // Check if metrics are stale (older than 24 hours)
        if (this.isMetricsStale()) {
          this.log('Restored metrics are stale (>24h), will use as fallback only');
        } else {
          this.log('Restored lastReceivedMetrics from Store successfully');
        }
        return;
      }

      // Fallback: reconstruct from capability values if Store is empty
      const reconstructed = this.reconstructMetricsFromCapabilities();
      if (reconstructed) {
        this.lastReceivedMetrics = reconstructed;
        this.log('Reconstructed metrics from capability values as fallback');
      }
    } catch (error) {
      this.error('Error restoring metrics from Store:', error);
      // Fallback: try to reconstruct from capabilities
      const reconstructed = this.reconstructMetricsFromCapabilities();
      if (reconstructed) {
        this.lastReceivedMetrics = reconstructed;
        this.log('Fallback: reconstructed metrics from capabilities');
      }
    }
  }

  /**
   * Reconstruct metrics from current capability values (fallback method)
   * Less precise than stored metrics but better than nothing
   */
  private reconstructMetricsFromCapabilities(): ZonneplanMetrics | null {
    try {
      const dailyEarned = this.getCapabilityValue('zonneplan_daily_earned');

      // Only reconstruct if we have at least some data
      if (dailyEarned === null || dailyEarned === undefined) {
        return null;
      }

      return {
        dailyEarned: dailyEarned as number,
        totalEarned: (this.getCapabilityValue('zonneplan_total_earned') as number) || 0,
        dailyCharged: (this.getCapabilityValue('zonneplan_daily_charged') as number) || 0,
        dailyDischarged: (this.getCapabilityValue('zonneplan_daily_discharged') as number) || 0,
        batteryPercentage: (this.getCapabilityValue('measure_battery') as number) || 0,
        cycleCount: (this.getCapabilityValue('zonneplan_cycle_count') as number) || 0,
        loadBalancingActive: (this.getCapabilityValue('zonneplan_load_balancing') as boolean) || false,
        timestamp: new Date(), // Use current time as approximation
      };
    } catch (error) {
      this.error('Error reconstructing metrics from capabilities:', error);
      return null;
    }
  }

  /**
   * Check if restored metrics are stale (older than 24 hours)
   */
  private isMetricsStale(): boolean {
    if (!this.lastReceivedMetrics) {
      return true;
    }

    const ageMs = Date.now() - this.lastReceivedMetrics.timestamp.getTime();
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

    return ageMs > maxAgeMs;
  }

  /**
   * Cleanup when device is uninitialized
   */
  async onUninit(): Promise<void> {
    this.log('ZonneplanBatteryDevice uninitialized');
    // Stop profile poller and measurements scheduler
    this.stopProfilePoller();
    this.stopMeasurementsScheduler();
  }

  /**
   * Cleanup when device is deleted
   */
  async onDeleted(): Promise<void> {
    this.log('ZonneplanBatteryDevice deleted from Homey');
    // Device has been removed, no further cleanup needed
  }
};
