// ========================================================================
// ENVIRONMENT CONFIGURATION & FEATURE FLAGS
// ========================================================================

export interface EnvironmentConfig {
  apiUrl: string;
  apiTimeout: number;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  features: FeatureFlags;
  thirdPartyIntegrations: ThirdPartyConfig;
  analytics: AnalyticsConfig;
}

// ========================================================================
// FEATURE FLAGS
// ========================================================================

export interface FeatureFlags {
  enableAutoDebit: boolean;
  enableAuctionBidding: boolean;
  enableSecondaryMarket: boolean; // Win Selling
  enableSnbl: boolean; // Save Now Buy Later
  enableSocialProposals: boolean;
  enableMultiSig: boolean; // Multi-signature approvals
  enableTelegramIntegration: boolean;
  enableUssdAccess: boolean;
  enableOfflineMode: boolean;
  enableA11y: boolean; // Accessibility features
  enableBiometricAuth: boolean;
  enableDarkMode: boolean;
  enableRtlLayout: boolean; // For Amharic/Tigrinya
  betaFeatures: boolean;
}

// ========================================================================
// THIRD-PARTY INTEGRATIONS
// ========================================================================

export interface ThirdPartyConfig {
  payment: {
    chapaApiKey: string;
    telebirrApiKey: string;
    cbeMerchantId: string;
  };
  identity: {
    faydaOidcUrl: string;
    faydaClientId: string;
  };
  banking: {
    ethswitchApiKey: string;
    nbeCrbApiKey: string;
  };
  communication: {
    telegramBotToken: string;
    smsProviderKey: string;
  };
  cloudServices: {
    cloudflareZoneId: string;
    s3Bucket: string;
    s3Region: string;
  };
}

// ========================================================================
// ANALYTICS & MONITORING
// ========================================================================

export interface AnalyticsConfig {
  enabled: boolean;
  provider: 'mixpanel' | 'amplitude' | 'custom';
  apiKey: string;
  enableErrorTracking: boolean;
  enablePerformanceTracking: boolean;
}

// ========================================================================
// ENVIRONMENT CONFIGURATION FACTORY
// ========================================================================

export class EnvironmentFactory {
  static getConfig(): EnvironmentConfig {
    const env = (process.env.NODE_ENV as string) || 'development';

    if (env === 'production') {
      return this.getProductionConfig();
    } else if (env === 'staging') {
      return this.getStagingConfig();
    } else {
      return this.getDevelopmentConfig();
    }
  }

  private static getProductionConfig(): EnvironmentConfig {
    return {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.qalnet.io/api/v1',
      apiTimeout: 30000,
      environment: 'production',
      logLevel: 'warn',
      features: {
        enableAutoDebit: true,
        enableAuctionBidding: true,
        enableSecondaryMarket: true,
        enableSnbl: true,
        enableSocialProposals: true,
        enableMultiSig: true,
        enableTelegramIntegration: true,
        enableUssdAccess: true,
        enableOfflineMode: true,
        enableA11y: true,
        enableBiometricAuth: true,
        enableDarkMode: true,
        enableRtlLayout: true,
        betaFeatures: false,
      },
      thirdPartyIntegrations: {
        payment: {
          chapaApiKey: process.env.NEXT_PUBLIC_CHAPA_API_KEY || '',
          telebirrApiKey: process.env.NEXT_PUBLIC_TELEBIRR_API_KEY || '',
          cbeMerchantId: process.env.NEXT_PUBLIC_CBE_MERCHANT_ID || '',
        },
        identity: {
          faydaOidcUrl: process.env.NEXT_PUBLIC_FAYDA_OIDC_URL || 'https://oidc.fayda.gov.et',
          faydaClientId: process.env.NEXT_PUBLIC_FAYDA_CLIENT_ID || '',
        },
        banking: {
          ethswitchApiKey: process.env.NEXT_PUBLIC_ETHSWITCH_API_KEY || '',
          nbeCrbApiKey: process.env.NEXT_PUBLIC_NBE_CRB_API_KEY || '',
        },
        communication: {
          telegramBotToken: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '',
          smsProviderKey: process.env.NEXT_PUBLIC_SMS_PROVIDER_KEY || '',
        },
        cloudServices: {
          cloudflareZoneId: process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID || '',
          s3Bucket: process.env.NEXT_PUBLIC_S3_BUCKET || '',
          s3Region: process.env.NEXT_PUBLIC_S3_REGION || 'eu-central-1',
        },
      },
      analytics: {
        enabled: true,
        provider: 'mixpanel',
        apiKey: process.env.NEXT_PUBLIC_ANALYTICS_API_KEY || '',
        enableErrorTracking: true,
        enablePerformanceTracking: true,
      },
    };
  }

  private static getStagingConfig(): EnvironmentConfig {
    return {
      ...this.getProductionConfig(),
      environment: 'staging',
      logLevel: 'info',
      features: {
        ...this.getProductionConfig().features,
        betaFeatures: true,
      },
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://staging-api.qalnet.io/api/v1',
    };
  }

  private static getDevelopmentConfig(): EnvironmentConfig {
    return {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
      apiTimeout: 60000,
      environment: 'development',
      logLevel: 'debug',
      features: {
        enableAutoDebit: true,
        enableAuctionBidding: true,
        enableSecondaryMarket: true,
        enableSnbl: true,
        enableSocialProposals: true,
        enableMultiSig: true,
        enableTelegramIntegration: false,
        enableUssdAccess: false,
        enableOfflineMode: true,
        enableA11y: true,
        enableBiometricAuth: false,
        enableDarkMode: true,
        enableRtlLayout: true,
        betaFeatures: true,
      },
      thirdPartyIntegrations: {
        payment: {
          chapaApiKey: process.env.NEXT_PUBLIC_CHAPA_API_KEY || 'test_chapa_key',
          telebirrApiKey: process.env.NEXT_PUBLIC_TELEBIRR_API_KEY || 'test_telebirr_key',
          cbeMerchantId: process.env.NEXT_PUBLIC_CBE_MERCHANT_ID || 'test_cbe_id',
        },
        identity: {
          faydaOidcUrl: process.env.NEXT_PUBLIC_FAYDA_OIDC_URL || 'https://oidc-test.fayda.gov.et',
          faydaClientId: process.env.NEXT_PUBLIC_FAYDA_CLIENT_ID || 'test_client_id',
        },
        banking: {
          ethswitchApiKey: process.env.NEXT_PUBLIC_ETHSWITCH_API_KEY || 'test_ethswitch_key',
          nbeCrbApiKey: process.env.NEXT_PUBLIC_NBE_CRB_API_KEY || 'test_nbe_key',
        },
        communication: {
          telegramBotToken: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '',
          smsProviderKey: process.env.NEXT_PUBLIC_SMS_PROVIDER_KEY || '',
        },
        cloudServices: {
          cloudflareZoneId: process.env.NEXT_PUBLIC_CLOUDFLARE_ZONE_ID || '',
          s3Bucket: process.env.NEXT_PUBLIC_S3_BUCKET || 'qalnet-dev',
          s3Region: process.env.NEXT_PUBLIC_S3_REGION || 'eu-central-1',
        },
      },
      analytics: {
        enabled: false,
        provider: 'custom',
        apiKey: '',
        enableErrorTracking: true,
        enablePerformanceTracking: true,
      },
    };
  }

  static isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
    const config = this.getConfig();
    return config.features[featureName];
  }

  static getThirdPartyConfig<K extends keyof ThirdPartyConfig>(key: K): ThirdPartyConfig[K] {
    const config = this.getConfig();
    return config.thirdPartyIntegrations[key];
  }
}

// ========================================================================
// CONFIGURATION EXPORT
// ========================================================================

export const config = EnvironmentFactory.getConfig();

export default config;
