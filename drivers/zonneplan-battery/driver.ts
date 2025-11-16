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
   * Handle pairing - simplified flow for virtual device
   * User provides device name, trading mode, and optional Onbalansmarkt API key
   */
  async onPair(session: Homey.Driver.PairSession) {
    // Session store for configuration
    let pairingData: {
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

    // Store device configuration from configure view
    session.setHandler('store_config', async (data: {
      deviceName: string;
      tradingMode: string;
    }) => {
      pairingData.deviceName = data.deviceName;
      pairingData.tradingMode = data.tradingMode;
      this.log('Configuration stored:', data);
      return true;
    });

    // Store API key from api_key view
    session.setHandler('store_api_key', async (data: {
      apiKey: string;
      autoSend: boolean;
    }) => {
      pairingData.apiKey = data.apiKey || '';
      pairingData.autoSend = data.autoSend;
      this.log('API key stored (length:', pairingData.apiKey.length, '), auto-send:', pairingData.autoSend);
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
          },
        },
      ];
    });
  }
};
