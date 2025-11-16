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
  private lastReceivedMetrics: ZonneplanMetrics | null = null;

  async onInit() {
    this.log('ZonneplanBatteryDevice initialized');

    // Initialize Onbalansmarkt client if API key is configured
    this.initializeOnbalansmarktClient();

    // Register flow card action handler
    this.registerFlowCardHandler();

    // Initialize capabilities with default values if not set
    await this.initializeCapabilities();

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

      // Update ranking capabilities with today's data
      if (profile.resultToday) {
        await this.setCapabilityValue('zonneplan_overall_rank', profile.resultToday.overallRank || 0);
        await this.setCapabilityValue('zonneplan_provider_rank', profile.resultToday.providerRank || 0);
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
      { name: 'zonneplan_cycle_count', value: 0 },
      { name: 'zonneplan_load_balancing', value: false },
      { name: 'zonneplan_last_update', value: 'Never' }, // Persistent - only set if capability is new
      { name: 'zonneplan_overall_rank', value: 0 },
      { name: 'zonneplan_provider_rank', value: 0 },
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
   * Register flow card action handler
   */
  private registerFlowCardHandler() {
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
  }

  /**
   * Handle received battery metrics
   */
  private async handleReceivedMetrics(metrics: ZonneplanMetrics) {
    this.log('Processing Zonneplan metrics:', JSON.stringify(metrics));

    // Store the latest metrics for scheduled sending
    this.lastReceivedMetrics = metrics;

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
