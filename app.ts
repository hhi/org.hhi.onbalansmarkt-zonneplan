'use strict';

import Homey from 'homey';

/**
 * Zonneplan Battery App
 *
 * Homey app for delivering Zonneplan battery trading results to onbalansmarkt.com
 */
module.exports = class ZonnePlanApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Zonneplan Battery App initialized');

    // Enable debug inspector if DEBUG environment variable is set
    if (process.env.DEBUG === '1') {
      this.log('Development mode detected, enabling debug inspector');
      try {
        // Dynamically import the debug inspector
        // @ts-expect-error - Dynamic import of ESM module in CommonJS context
        const { default: enableDebugInspector } = await import('./app-debug');
        await enableDebugInspector();
        this.log('Debug inspector enabled');
      } catch (error) {
        this.error('Failed to enable debug inspector:', error);
      }
    }
  }

};
