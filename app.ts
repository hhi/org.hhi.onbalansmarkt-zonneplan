'use strict';

import Homey from 'homey';

interface ZonneplanMetrics {
  dailyEarned: number;
  totalEarned: number;
  dailyCharged: number;
  dailyDischarged: number;
  batteryPercentage: number;
  cycleCount: number;
  loadBalancingActive: boolean;
}

/**
 * Zonneplan Battery App
 *
 * Homey app for delivering Zonneplan battery trading results to onbalansmarkt.com
 */
module.exports = class ZonnePlanApp extends Homey.App {
  private tokens: Record<string, Homey.FlowToken> = {};

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Zonneplan Battery App initialized');

    // Initialize global flow tokens for metrics
    await this.initializeGlobalTokens();

    this.log('Zonneplan Battery App ready');
  }

  /**
   * Initialize global flow tokens that can be used across flows
   */
  private async initializeGlobalTokens() {
    try {
      // Get or create tokens - reuse existing ones if they exist
      this.tokens.dailyEarned = await this.getOrCreateToken('zp_daily_earned', {
        type: 'number',
        title: 'Daily earned (€)',
        value: 0,
      });

      this.tokens.totalEarned = await this.getOrCreateToken('zp_total_earned', {
        type: 'number',
        title: 'Total earned (€)',
        value: 0,
      });

      this.tokens.dailyCharged = await this.getOrCreateToken('zp_daily_charged', {
        type: 'number',
        title: 'Daily charged (kWh)',
        value: 0,
      });

      this.tokens.dailyDischarged = await this.getOrCreateToken('zp_daily_discharged', {
        type: 'number',
        title: 'Daily discharged (kWh)',
        value: 0,
      });

      this.tokens.batteryPercentage = await this.getOrCreateToken('zp_battery_percentage', {
        type: 'number',
        title: 'Battery percentage (%)',
        value: 0,
      });

      this.tokens.cycleCount = await this.getOrCreateToken('zp_cycle_count', {
        type: 'number',
        title: 'Cycle count',
        value: 0,
      });

      this.tokens.loadBalancingActive = await this.getOrCreateToken('zp_load_balancing_active', {
        type: 'boolean',
        title: 'Load balancing active',
        value: false,
      });

      this.log('Global flow tokens initialized');
    } catch (error) {
      this.error('Failed to initialize global flow tokens:', error);
    }
  }

  /**
   * Get existing token or create new one if it doesn't exist
   */
  private async getOrCreateToken(
    id: string,
    opts: { type: 'number' | 'boolean'; title: string; value: number | boolean },
  ): Promise<Homey.FlowToken> {
    try {
      // Try to get existing token first
      const existing = this.homey.flow.getToken(id);
      this.log(`Reusing existing token: ${id}`);
      return existing;
    } catch (error) {
      // Token doesn't exist, create it
      this.log(`Creating new token: ${id}`);
      return this.homey.flow.createToken(id, opts);
    }
  }

  /**
   * Handle metrics from device and update global tokens
   * Called by device instances when metrics are received
   */
  async handleMetrics(metrics: ZonneplanMetrics): Promise<void> {
    try {
      // Ensure all tokens are initialized before updating
      if (!this.tokens.dailyEarned) {
        this.log('WARNING: Tokens not initialized, reinitializing...');
        await this.initializeGlobalTokens();
      }

      // Update tokens and wait for completion - no optional chaining so errors surface
      const updates = [
        this.tokens.dailyEarned.setValue(metrics.dailyEarned),
        this.tokens.totalEarned.setValue(metrics.totalEarned),
        this.tokens.dailyCharged.setValue(metrics.dailyCharged),
        this.tokens.dailyDischarged.setValue(metrics.dailyDischarged),
        this.tokens.batteryPercentage.setValue(metrics.batteryPercentage),
        this.tokens.cycleCount.setValue(metrics.cycleCount),
        this.tokens.loadBalancingActive.setValue(metrics.loadBalancingActive),
      ];

      const results = await Promise.allSettled(updates);

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.error(`Token update failed at index ${index}:`, result.reason);
        }
      });

      this.log('Global flow tokens updated successfully');

      // Debug dump: show values that were set
      this.log('=== TOKEN VALUE DUMP ===');
      this.log(`  zp_daily_earned: ${metrics.dailyEarned}`);
      this.log(`  zp_total_earned: ${metrics.totalEarned}`);
      this.log(`  zp_daily_charged: ${metrics.dailyCharged}`);
      this.log(`  zp_daily_discharged: ${metrics.dailyDischarged}`);
      this.log(`  zp_battery_percentage: ${metrics.batteryPercentage}`);
      this.log(`  zp_cycle_count: ${metrics.cycleCount}`);
      this.log(`  zp_load_balancing_active: ${metrics.loadBalancingActive}`);
      this.log('========================');
    } catch (error) {
      this.error('Failed to update global flow tokens:', error);
      throw error; // Re-throw so device.ts can see the failure
    }
  }

};
