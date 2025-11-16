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

    // Debug inspector is optional - only load if explicitly needed
    // Skipping to avoid module resolution issues in test environments
  }

};
