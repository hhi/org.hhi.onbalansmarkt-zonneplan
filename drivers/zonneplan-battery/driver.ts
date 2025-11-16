import Homey from 'homey';

/**
 * Zonneplan Battery Driver
 *
 * Handles pairing of Zonneplan battery devices.
 * Creates a virtual device that receives battery data via Homey flow cards.
 */
export = class ZonneplanBatteryDriver extends Homey.Driver {
  async onInit() {
    this.log('ZonneplanBatteryDriver initialized');
  }

  /**
   * Handle pairing - combined form for virtual device
   * User provides device name, trading mode (default: manual), and Onbalansmarkt API key (required)
   */
  async onPair(session: Homey.Driver.PairSession) {
    // Session store for configuration
    const pairingData: {
      deviceName: string;
      tradingMode: string;
      apiKey: string;
      autoSend: boolean;
    } = {
      deviceName: 'Zonneplan Battery',
      tradingMode: 'manual',
      apiKey: '',
      autoSend: false,
    };

    // Store all configuration from combined form
    session.setHandler('store_config', async (data: {
      deviceName: string;
      tradingMode: string;
      apiKey: string;
      autoSend: boolean;
    }) => {
      pairingData.deviceName = data.deviceName;
      pairingData.tradingMode = data.tradingMode || 'manual'; // Default to manual
      pairingData.apiKey = data.apiKey || '';
      pairingData.autoSend = data.autoSend || false; // Default to false
      this.log('Configuration stored:', {
        deviceName: pairingData.deviceName,
        tradingMode: pairingData.tradingMode,
        apiKeyLength: pairingData.apiKey.length,
        autoSend: pairingData.autoSend,
      });
      return true;
    });

    // Create virtual device
    session.setHandler('list_devices', async () => {
      // Generate unique device ID
      const deviceId = `zonneplan-battery-${Date.now()}`;

      return [
        {
          name: pairingData.deviceName,
          data: {
            id: deviceId,
            type: 'zonneplan-battery',
          },
          settings: {
            device_name: pairingData.deviceName,
            trading_mode: pairingData.tradingMode,
            total_earned_offset: 0,
            onbalansmarkt_api_key: pairingData.apiKey,
            auto_send_measurements: pairingData.autoSend,
            exclude_from_energy: true,
            measurements_send_enabled: false, // Default to disabled
            measurements_send_interval: 15, // Default to 15 minutes
            measurements_send_start_minute: 0, // Default to start of hour
          },
        },
      ];
    });
  }
};
