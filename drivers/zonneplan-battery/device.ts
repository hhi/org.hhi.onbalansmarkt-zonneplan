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

  async onInit() {
    this.log('ZonneplanBatteryDevice initialized');

    // Initialize Onbalansmarkt client if API key is configured
    this.initializeOnbalansmarktClient();

    // Register flow card action handler
    this.registerFlowCardHandler();

    // Initialize capabilities with default values if not set
    await this.initializeCapabilities();

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
   * Initialize capabilities with default values
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
      { name: 'zonneplan_last_update', value: 'Never' },
    ];

    for (const cap of capabilities) {
      if (!this.hasCapability(cap.name)) {
        try {
          await this.addCapability(cap.name);
          this.log(`Added capability: ${cap.name}`);
        } catch (error) {
          this.error(`Failed to add capability ${cap.name}:`, error);
        }
      }

      // Set default value if not yet set
      try {
        const currentValue = this.getCapabilityValue(cap.name);
        if (currentValue === null || currentValue === undefined) {
          await this.setCapabilityValue(cap.name, cap.value);
        }
      } catch (error) {
        // Ignore errors for capabilities that might not exist yet
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
    // Cleanup is minimal as we don't have active timers or intervals
    // All resources will be cleaned up by Homey
  }

  /**
   * Cleanup when device is deleted
   */
  async onDeleted(): Promise<void> {
    this.log('ZonneplanBatteryDevice deleted from Homey');
    // Device has been removed, no further cleanup needed
  }
};
