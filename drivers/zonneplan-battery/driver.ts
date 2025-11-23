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
   * Handle pairing - form with device creation
   */
  async onPair(session: Homey.Driver.PairSession) {
    this.log('onPair session started');

    const pairingData = {
      deviceName: 'Zonneplan Battery',
      tradingMode: 'manual',
      apiKey: '',
    };

    // Handler for storing config from configure view
    session.setHandler('store_config', async (data: {
      deviceName: string;
      tradingMode: string;
      apiKey: string;
    }) => {
      this.log('store_config handler called with:', {
        deviceName: data.deviceName,
        tradingMode: data.tradingMode,
        apiKeyLength: data.apiKey?.length || 0,
      });

      pairingData.deviceName = data.deviceName || 'Zonneplan Battery';
      pairingData.tradingMode = data.tradingMode || 'manual';
      pairingData.apiKey = data.apiKey || '';

      this.log('Pairing data stored');
      return true;
    });

    // Handler for listing devices in list_devices view
    session.setHandler('list_devices', async () => {
      this.log('list_devices handler called');

      if (!pairingData.deviceName) {
        throw new Error('Device name not configured. Please restart pairing.');
      }

      const deviceId = `zonneplan-battery-${Date.now()}`;
      const device = {
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
          exclude_from_energy: true,
          measurements_send_enabled: false,
          measurements_send_interval: 15,
          measurements_send_start_minute: 0,
        },
      };

      this.log('Creating device:', {
        name: device.name,
        dataId: device.data.id,
        tradingMode: device.settings.trading_mode,
      });

      return [device];
    });

    this.log('onPair handlers registered successfully');
  }
};
