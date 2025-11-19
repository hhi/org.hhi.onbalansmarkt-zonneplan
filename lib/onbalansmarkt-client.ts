/**
 * Onbalansmarkt.com API Client
 *
 * Sends battery trading measurements to the Onbalansmarkt.com live API endpoint.
 */

export type TradingMode =
  | 'imbalance'
  | 'imbalance_aggressive'
  | 'manual'
  | 'day_ahead'
  | 'self_consumption'
  | 'self_consumption_plus';

export type ResultType = 'manual' | 'api' | 'auto' | 'direct';

export interface DailyResult {
  date: string;
  type: ResultType;
  batteryResult: number;
  batteryCharged: number;
  batteryDischarged: number;
  solarResult: number;
  chargerResult: number;
  batteryResultTotal: number;
  batteryResultImbalance: number;
  batteryResultEpex: number;
  batteryResultCustom: number;
  mode: TradingMode;
  note: string;
  overallRank: number;
  providerRank: number;
}

export interface ProfileResponse {
  username: string;
  name: string;
  resultToday: DailyResult | null;
  resultYesterday: DailyResult | null;
}

export interface OnbalansmarktMeasurement {
  timestamp: Date;
  batteryResult: number;
  batteryResultTotal: number;
  batteryCharge?: number | null;
  batteryPower?: number | null;
  chargedToday?: number | null;
  dischargedToday?: number | null;
  loadBalancingActive?: 'on' | 'off' | null;
  solarResult?: number | null;
  chargerResult?: number | null;
  batteryResultEpex?: number | null;
  batteryResultImbalance?: number | null;
  batteryResultCustom?: number | null;
  batteryResultAccounting?: number | null;
  totalBatteryCycles?: number | null;
  mode?: TradingMode | null;
}

export interface OnbalansmarktClientConfig {
  apiKey: string;
  logger?: (message: string, ...args: unknown[]) => void;
}

export class OnbalansmarktClient {
  private readonly apiUrlLive = 'https://onbalansmarkt.com/api/live';
  private readonly apiUrlMe = 'https://onbalansmarkt.com/api/me';
  private readonly apiKey: string;
  private logger: (message: string, ...args: unknown[]) => void;

  constructor(config: OnbalansmarktClientConfig) {
    this.apiKey = config.apiKey;
    this.logger = config.logger || (() => {});
  }

  /**
   * Send a measurement to Onbalansmarkt.com
   * @param measurement Measurement data
   * @returns API response text
   */
  async sendMeasurement(measurement: OnbalansmarktMeasurement): Promise<string> {
    // Validate required fields - check for null/undefined, allow 0 values
    if (
      !measurement.timestamp
      || measurement.batteryResult === null
      || measurement.batteryResult === undefined
      || measurement.batteryResultTotal === null
      || measurement.batteryResultTotal === undefined
    ) {
      throw new Error('timestamp, batteryResult and batteryResultTotal are required fields');
    }

    // Prepare the payload - convert numbers to strings as API expects
    const payload: Record<string, string> = {
      timestamp: measurement.timestamp.toISOString(),
      batteryResult: measurement.batteryResult.toString(),
      batteryResultTotal: measurement.batteryResultTotal.toString(),
    };

    // Add optional fields if provided (not null/undefined)
    if (measurement.batteryCharge !== null && measurement.batteryCharge !== undefined) {
      payload.batteryCharge = measurement.batteryCharge.toString();
    }
    if (measurement.batteryPower !== null && measurement.batteryPower !== undefined) {
      payload.batteryPower = measurement.batteryPower.toString();
    }
    if (measurement.chargedToday !== null && measurement.chargedToday !== undefined) {
      payload.chargedToday = measurement.chargedToday.toString();
    }
    if (measurement.dischargedToday !== null && measurement.dischargedToday !== undefined) {
      payload.dischargedToday = measurement.dischargedToday.toString();
    }
    if (measurement.loadBalancingActive !== null && measurement.loadBalancingActive !== undefined) {
      payload.loadBalancingActive = measurement.loadBalancingActive.toString();
    }
    if (measurement.solarResult !== null && measurement.solarResult !== undefined) {
      payload.solarResult = measurement.solarResult.toString();
    }
    if (measurement.chargerResult !== null && measurement.chargerResult !== undefined) {
      payload.chargerResult = measurement.chargerResult.toString();
    }
    if (measurement.batteryResultEpex !== null && measurement.batteryResultEpex !== undefined) {
      payload.batteryResultEpex = measurement.batteryResultEpex.toString();
    }
    if (measurement.batteryResultImbalance !== null && measurement.batteryResultImbalance !== undefined) {
      payload.batteryResultImbalance = measurement.batteryResultImbalance.toString();
    }
    if (measurement.batteryResultCustom !== null && measurement.batteryResultCustom !== undefined) {
      payload.batteryResultCustom = measurement.batteryResultCustom.toString();
    }
    if (measurement.batteryResultAccounting !== null && measurement.batteryResultAccounting !== undefined) {
      payload.batteryResultAccounting = measurement.batteryResultAccounting.toString();
    }
    if (measurement.totalBatteryCycles !== null && measurement.totalBatteryCycles !== undefined) {
      payload.totalBatteryCycles = measurement.totalBatteryCycles.toString();
    }
    if (measurement.mode !== null && measurement.mode !== undefined) {
      payload.mode = measurement.mode.toString();
    }

    try {
      this.logger('OnbalansmarktClient: Sending measurement', payload);

      const response = await fetch(this.apiUrlLive, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorDetails = `HTTP ${response.status} ${response.statusText}`;

        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorDetails += `: ${JSON.stringify(errorData)}`;
          } catch {
            // Failed to parse JSON error response
          }
        } else if (contentType.includes('text/html')) {
          errorDetails += ' (HTML response - API may be down or invalid API key)';
        }

        this.logger(`OnbalansmarktClient HTTP error: ${errorDetails}`);
        throw new Error(`API returned ${errorDetails}`);
      }

      const responseText = await response.text();
      this.logger('OnbalansmarktClient: Successfully sent measurement');
      return responseText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger(`OnbalansmarktClient: Error sending measurement: ${errorMessage}`);
      throw new Error(`Failed to send measurement: ${errorMessage}`);
    }
  }

  /**
   * Get user profile including today's and yesterday's results with ranking information
   * @returns Profile with ranking data
   */
  async getProfile(): Promise<ProfileResponse> {
    try {
      this.logger('OnbalansmarktClient: Fetching profile data');

      const response = await fetch(this.apiUrlMe, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorDetails = `HTTP ${response.status} ${response.statusText}`;

        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorDetails += `: ${JSON.stringify(errorData)}`;
          } catch {
            // Failed to parse JSON error response
          }
        } else if (contentType.includes('text/html')) {
          errorDetails += ' (HTML response - API may be down or invalid API key)';
        }

        this.logger(`OnbalansmarktClient HTTP error: ${errorDetails}`);
        throw new Error(`API returned ${errorDetails}`);
      }

      // Check Content-Type before parsing JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const responseText = await response.text();
        this.logger(`OnbalansmarktClient unexpected content type: ${contentType}`);
        this.logger(`Response preview: ${responseText.substring(0, 200)}`);
        throw new Error(`Expected JSON response but got ${contentType}. API may have changed or invalid API key.`);
      }

      // API structure (updated Nov 2025): { username, name, resultToday, resultYesterday }
      // Direct result objects instead of array
      interface ApiResponse {
        username: string;
        name: string;
        resultToday?: DailyResult | null;
        resultYesterday?: DailyResult | null;
        // Legacy support for older API structure
        results?: DailyResult[];
        profile?: {
          results?: DailyResult[];
        };
        dailyResults?: DailyResult[];
        [key: string]: unknown;
      }

      const apiResponse = (await response.json()) as ApiResponse;

      // Try new API structure first (direct resultToday/resultYesterday)
      let resultToday: DailyResult | null = apiResponse.resultToday || null;
      let resultYesterday: DailyResult | null = apiResponse.resultYesterday || null;

      // Fallback to legacy array-based structure if needed
      if (!resultToday && !resultYesterday) {
        let resultsArray: DailyResult[] | undefined = apiResponse.results;

        if (!resultsArray && apiResponse.profile?.results) {
          resultsArray = apiResponse.profile.results;
        }
        if (!resultsArray && apiResponse.dailyResults) {
          resultsArray = apiResponse.dailyResults;
        }

        if (resultsArray && Array.isArray(resultsArray)) {
          // Get today's and yesterday's dates in YYYY-MM-DD format
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];

          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          // Find today's and yesterday's results from the array
          resultToday = resultsArray.find((r) => r.date === todayStr) || null;
          resultYesterday = resultsArray.find((r) => r.date === yesterdayStr) || null;
        }
      }

      const profile: ProfileResponse = {
        username: apiResponse.username,
        name: apiResponse.name,
        resultToday,
        resultYesterday,
      };

      // Log comprehensive profile data including all available fields
      this.logger(
        `\n📊 Onbalansmarkt Profile Data (from /api/me):\n` +
        `  Account:\n` +
        `    Username: ${profile.username}\n` +
        `    Name: ${profile.name}\n` +
        `\n  Today's Results (${resultToday?.date || 'N/A'}):\n` +
        (resultToday ? `    batteryResult: €${resultToday.batteryResult}\n` +
        `    batteryResultTotal: €${resultToday.batteryResultTotal}\n` +
        `    batteryResultImbalance: €${resultToday.batteryResultImbalance}\n` +
        `    batteryResultEpex: €${resultToday.batteryResultEpex}\n` +
        `    batteryResultCustom: €${resultToday.batteryResultCustom}\n` +
        `    solarResult: €${resultToday.solarResult}\n` +
        `    chargerResult: €${resultToday.chargerResult}\n` +
        `    batteryCharged: ${resultToday.batteryCharged}\n` +
        `    batteryDischarged: ${resultToday.batteryDischarged}\n` +
        `    type: ${resultToday.type}\n` +
        `    mode: ${resultToday.mode}\n` +
        `    overallRank: ${resultToday.overallRank}\n` +
        `    providerRank: ${resultToday.providerRank}\n` +
        `    note: ${resultToday.note || '(none)'}` : '    (No data yet)\n') +
        `\n  Yesterday's Results (${resultYesterday?.date || 'N/A'}):\n` +
        (resultYesterday ? `    batteryResult: €${resultYesterday.batteryResult}\n` +
        `    batteryResultTotal: €${resultYesterday.batteryResultTotal}\n` +
        `    batteryResultImbalance: €${resultYesterday.batteryResultImbalance}\n` +
        `    batteryResultEpex: €${resultYesterday.batteryResultEpex}\n` +
        `    batteryResultCustom: €${resultYesterday.batteryResultCustom}\n` +
        `    type: ${resultYesterday.type}\n` +
        `    overallRank: ${resultYesterday.overallRank}\n` +
        `    providerRank: ${resultYesterday.providerRank}` : '    (No data yet)\n'),
      );

      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger(`OnbalansmarktClient: Error fetching profile: ${errorMessage}`);
      throw new Error(`Failed to fetch profile: ${errorMessage}`);
    }
  }
}
